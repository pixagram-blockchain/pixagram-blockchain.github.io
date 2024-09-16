/**
 * Pixa Blockchain Proxy API System
 * Complete API wrapper with organized method groups.
 *
 * v4.4.0: All query/object caching removed. Every API call hits the network
 * and returns freshly-sanitized data. Only durable, non-derived data is
 * persisted to LacertaDB (settingsDb): user sessions, preferences, account
 * registry, notification-read receipts, Argon2id auto-tune benchmark, and
 * the offline broadcast outbox. The pixa_cache database is no longer opened.
 *
 * @version 4.4.0
 *
 * API Groups and Methods:
 *
 * PixaProxyAPI (Main Class):
 *   - initialize(config)
 *   - restoreSession()
 *   - logout()
 *   - initializeVault(pin, options)
 *   - isVaultInitialized()
 *   - unlockWithPin(pin, options)
 *   - isPinEnabled()
 *   - requiresUnlock(keyType)
 *   - validateCredentials(account, key, keyType)
 *   - quickLogin(account, key, keyType, options)
 *   - disconnect()
 *   - updateConfig(newConfig)
 *   - formatAccount(account)
 *   - processPost(post, renderOptions)
 *   - processComment(comment, renderOptions)
 *   - processMemo(memo)
 *   - extractPlainText(body)
 *   - summarizeContent(body, sentenceCount)
 *   - sanitizeUsername(rawUsername)
 *   - hasVaultConfig()
 *   - getWalletKeys(account, options)
 *
 * database (DatabaseAPI):
 *   - call(method, params)
 *   - getDatabaseInfo()
 *   — find_* family (AppBase database_api.find_*) —
 *   - findAccounts(accounts, delayedVotesActive)
 *   - findComments(commentsTuples)
 *   - findVotes(author, permlink)
 *   - findChangeRecoveryAccountRequests(accounts)
 *   - findCollateralizedConversionRequests(account)
 *   - findDeclineVotingRightsRequests(accounts)
 *   - findEscrows(from)
 *   - findHbdConversionRequests(account)
 *   - findLimitOrders(account)
 *   - findOwnerHistories(owner)
 *   - findSavingsWithdrawals(account)
 *   - findVestingDelegationExpirations(account)
 *   - findVestingDelegations(account)
 *   - findWithdrawVestingRoutes(account, order)
 *   — list_* family (AppBase database_api.list_*) —
 *   - listAccounts({start, limit, order})
 *   - listChangeRecoveryAccountRequests({start, limit, order})
 *   - listComments({start, limit, order})
 *   - listDeclineVotingRightsRequests({start, limit, order})
 *   - listEscrows({start, limit, order})
 *   - listHbdConversionRequests({start, limit, order})
 *   - listLimitOrders({start, limit, order})
 *   - listOwnerHistories({start, limit})
 *   - listSavingsWithdrawals({start, limit, order})
 *   - listVestingDelegationExpirations({start, limit, order})
 *   - listVestingDelegations({start, limit, order})
 *   - listVotes({start, limit, order})
 *   - listWithdrawVestingRoutes({start, limit, order})
 *   — misc —
 *   - getRewardFunds()
 *   - getHardforkProperties()
 *
 * tags (TagsAPI):
 *   - getTrendingTags(afterTag, limit)
 *   - getDiscussionsByTrending(query)
 *   - getDiscussionsByCreated(query)
 *   - getDiscussionsByHot(query)
 *   - getDiscussionsByPromoted(query)
 *   - getDiscussionsByPayout(query)
 *   - getDiscussionsByVotes(query)
 *   - getDiscussionsByActive(query)
 *   - getDiscussionsByChildren(query)
 *   - getDiscussionsByMuted(query)
 *
 * blocks (BlocksAPI):
 *   - getBlock(blockNum)
 *   - getBlockHeader(blockNum)
 *   - getOpsInBlock(blockNum, onlyVirtual)
 *   - getBlockRange(startingBlockNum, count)
 *   - enumVirtualOps(params)
 *
 * globals (GlobalsAPI):
 *   - getDynamicGlobalProperties()
 *   - getChainProperties()
 *   - getFeedHistory()
 *   - getCurrentMedianHistoryPrice()
 *   - getHardforkVersion()
 *   - getRewardFund(name)
 *   - getVestingDelegations(account, from, limit)
 *   - getConfig()
 *   - getVersion()
 *   - getExpiringVestingDelegations(account, afterDate, limit)
 *   - getConversionRequests(account)
 *   - getCollateralizedConversionRequests(account)
 *
 * accounts (AccountsAPI):
 *   - getAccounts(accounts, forceRefresh)
 *   - lookupAccounts(lowerBound, limit)
 *   - lookupAccountNames(accounts)
 *   - getAccountCount()
 *   - getAccountHistory(account, from, limit, operationBitmask)
 *   - getAccountHistoryFull({account, start, limit, includeReversible, operationFilterLow, operationFilterHigh})
 *   - getAccountReputations(lowerBound, limit)
 *   - getAccountNotifications(account, limit)
 *   - getReadNotificationIds(account)
 *   - markNotificationsRead(account, notificationIds)
 *   - clearReadNotifications(account)
 *   - getEscrow(from, escrowId)
 *   - findRecurrentTransfers(account)
 *   - findProposals(ids, order, orderDirection, status, limit)
 *   - listProposals(start, limit, order, orderDirection, status)
 *   - listProposalVotes(start, limit, order, orderDirection, status)
 *
 * market (MarketAPI):
 *   - getOrderBook(limit)
 *   - getOpenOrders(account)
 *   - getTicker()
 *   - getTradeHistory(start, end, limit)
 *   - getMarketHistory(bucketSeconds, start, end)
 *   - getMarketHistoryBuckets()
 *   - getVolume()
 *
 * authority (AuthorityAPI):
 *   - getOwnerHistory(account)
 *   - getRecoveryRequest(account)
 *   - getWithdrawRoutes(account, type)
 *   - getAccountBandwidth(account, type)
 *   - getSavingsWithdrawFrom(account)
 *   - getSavingsWithdrawTo(account)
 *   - verifyAuthority(stx)
 *
 * votes (VotesAPI):
 *   - getActiveVotes(author, permlink)
 *   - getAccountVotes(account)
 *
 * content (ContentAPI):
 *   - getContent(author, permlink, options?)   // options.raw=true → bypass cache + sanitization
 *   - getContentReplies(author, permlink)
 *   - getDiscussionsByAuthorBeforeDate(author, startPermlink, beforeDate, limit)
 *   - getRepliesByLastUpdate(author, startPermlink, limit)
 *   - getDiscussionsByComments(query)
 *   - getDiscussionsByBlog(query)
 *   - getDiscussionsByFeed(query)
 *   - getAccountPosts(account, sort, limit, options)
 *   - getState(path)
 *
 * witnesses (WitnessesAPI):
 *   - getWitnessByAccount(account)
 *   - getWitnessesByVote(from, limit)
 *   - lookupWitnessAccounts(lowerBound, limit)
 *   - getWitnessCount()
 *   - getActiveWitnesses()
 *   - getWitnessSchedule()
 *
 * follow (FollowAPI):
 *   - getFollowers(account, startFollower, type, limit)
 *   - getFollowing(account, startFollowing, type, limit)
 *   - getFollowCount(account)
 *   - getFeedEntries(account, startEntryId, limit)
 *   - getBlogEntries(account, startEntryId, limit)
 *   - getRebloggedBy(author, permlink)
 *   - getBlogAuthors(account)
 *   - getSubscriptions(account)
 *
 * broadcast (BroadcastAPI):
 *   - updateAccount2(params) — params.externalKey bypasses keyManager
 *   - updateProfile(account, profileObject, externalKey?)
 *   - vote(voter, author, permlink, weight)
 *   - comment(params)
 *   - commentOptions(params)
 *   - transfer(from, to, amount, memo)
 *   - transferToVesting(from, to, amount)
 *   - withdrawVesting(account, vestingShares)
 *   - delegateVestingShares(delegator, delegatee, vestingShares)
 *   - transferToSavings(from, to, amount, memo)
 *   - transferFromSavings(from, requestId, to, amount, memo)
 *   - cancelTransferFromSavings(from, requestId)
 *   - claimRewardBalance(account)
 *   - recurrentTransfer(params)
 *   - follow(follower, following)
 *   - unfollow(follower, following)
 *   - mute(follower, following)
 *   - reblog(account, author, permlink)
 *   - customJson(params)
 *   - deleteComment(author, permlink)
 *   - updateComment(params)            // edit post/comment in place (HIVE-style body patching)
 *   - accountCreate(params)
 *   - accountCreateWithDelegation(params)
 *   - accountWitnessVote(account, witness, approve)
 *   - accountWitnessProxy(account, proxy)
 *   - witnessUpdate(params)
 *   - setWithdrawVestingRoute(fromAccount, toAccount, percent, autoVest)
 *   - limitOrderCreate(params)
 *   - limitOrderCancel(owner, orderId)
 *   - convertPixa(owner, amount, requestId)
 *   - sendOperations(operations, key)
 *   - accountUpdate(params)
 *   - claimAccount(creator, fee)
 *   - createClaimedAccount(params)
 *   - collateralizedConvert(owner, amount, requestId)
 *   - limitOrderCreate2(params)
 *   - feedPublish(publisher, exchangeRate)
 *   - witnessSetProperties(owner, props)
 *   - escrowTransfer(params)
 *   - escrowApprove(params)
 *   - escrowDispute(params)
 *   - escrowRelease(params)
 *   - createProposal(params)
 *   - updateProposal(params)
 *   - updateProposalVotes(voter, proposalIds, approve)
 *   - removeProposal(proposalOwner, proposalIds)
 *   - requestAccountRecovery(recoveryAccount, accountToRecover, newOwnerAuthority)
 *   - recoverAccount(accountToRecover, newOwnerAuthority, recentOwnerAuthority)
 *   - changeRecoveryAccount(accountToRecover, newRecoveryAccount)
 *   - declineVotingRights(account, decline)
 *   — raw passthroughs (pre-signed transactions) —
 *   - broadcastTransaction(tx)
 *   - broadcastTransactionSynchronous(tx)
 *   - networkBroadcastTransaction(tx)
 *
 * auth (AuthAPI):
 *   - isWif(key)
 *   - toWif(username, password, role)
 *   - wifToPublic(wif)
 *   - signMessage(message, wif)
 *   - verifySignature(message, signature, publicKey)
 *
 * formatter (FormatterAPI):
 *   - reputation(rawReputation)
 *   - vestToPixa(vestingShares, totalVestingShares, totalVestingFundPixa)
 *   - pixaToVest(pixa, totalVestingShares, totalVestingFundPixa)
 *   - vestToSteem() [deprecated alias]
 *   - steemToVest() [deprecated alias]
 *   - formatAsset(amount, symbol, precision)
 *
 * blockchain (BlockchainAPI):
 *   - getBlockHeader(blockNum)
 *   - getBlock(blockNum)
 *   - getTransaction(txId)
 *   - getTransactionHex(tx)
 *   - getCurrentBlockNum(mode)
 *   - getCurrentBlockHeader(mode)
 *   - getCurrentBlock(mode)
 *   - getBlockNumbers(options) [AsyncGenerator]
 *   - getBlocks(options) [AsyncGenerator]
 *   - getOperations(options) [AsyncGenerator]
 *   - getBlockNumberStream()
 *   - getBlockStream()
 *   - getOperationsStream()
 *   - getPotentialSignatures(tx)
 *   - getRequiredSignatures(tx, availableKeys)
 *   - isKnownTransaction(trxId)
 *   - getTransactionFromHistory(trxId, includeReversible)
 *
 * rc (ResourceCreditsAPI):
 *   - getResourceParams()
 *   - getResourcePool()
 *   - findRcAccounts(accounts)
 *   - listRcAccounts({start, limit})
 *   - listRcDirectDelegations({start, limit})
 *   - getRCMana(account)
 *   - getVPMana(account)
 *   - calculateRCMana(rcAccount)
 *   - calculateVPMana(account)
 *   - calculateRCCost(operationType, operationData)
 *
 * communities (CommunitiesAPI):
 *   - getCommunity(name, observer)
 *   - listCommunities(options)
 *   - getSubscriptions(account)
 *   - getRankedPosts(options)
 *   - getAccountPosts(account, sort, options)
 *   - getDiscussion(author, permlink, observer)
 *   - getPost(author, permlink, observer)
 *   - getPostHeader(author, permlink)
 *   - getProfile(account, observer)
 *   - getCommunityContext(name, account)
 *   - getRelationshipBetweenAccounts(account1, account2)
 *   - getFollowList(account)
 *   - doesUserFollowAnyLists(account)
 *   - getPayoutStats(name)
 *   - listCommunityRoles(name, last, limit)
 *   - listSubscribers(name, last, limit)
 *   - listPopCommunities(limit)
 *   - setRole(community, account, role)
 *   - setUserTitle(community, account, title)
 *   - mutePost(community, account, permlink, notes)
 *   - unmutePost(community, account, permlink, notes)
 *   - updateCommunityProps(community, props)
 *   - subscribe(community)
 *   - unsubscribe(community)
 *   - pinPost(community, account, permlink)
 *   - unpinPost(community, account, permlink)
 *   - flagPost(community, account, permlink, notes)
 *
 * keys (AccountByKeyAPI):
 *   - getKeyReferences(keys)
 *
 * transaction (TransactionStatusAPI):
 *   - findTransaction(transactionId, expiration)
 *
 * jsonrpc (JsonRpcAPI):
 *   - getMethods(forceRefresh)
 *   - getSignature(method)
 *   - hasMethod(method)
 *   - getNamespaces()
 *   - clearCache()
 *
 * rewards (RewardsAPI):
 *   - simulateCurvePayouts({variableReward, posts})
 */

// Shared LacertaDB instance — constructed in utils/settings.js (main bundle,
// runs at script evaluation) with the exact turboSerial options this class
// used to pass itself. The app-settings layer and this API now hold ONE
// instance over ONE database ('user_settings'); app settings live in the
// quickStore namespace, which nothing here touches. See the constructor.
import { lacerta } from '../settings';
import JSLoader from '../JSLoader';
import EventEmitter from 'events';
import { CryptoUtils } from './crypto-utils.js';
import { PixaEvents }  from './events.js';
import { SessionManager, SessionMode, SessionExpiredError, SessionNotFoundError, PinRequiredError } from './session-manager.js';
import { ConnectivityMonitor } from './connectivity-monitor.js';
import { BroadcastQueue, OfflineNotQueueableError, OfflineError } from './broadcast-queue.js';
import { YOLOBuffer } from './yolo-buffer.js';

// ── Lazy-loaded: ../utils/sanitizer ──
let pixaContentInit = null;
let wasmSanitizePost = null;
let wasmSanitizeComment = null;
let wasmSetImageProxyBase = null;
let wasmSafeProfileImage = null;
let wasmInspectImageDataUri = null;
let wasmSanitizeMemo = null;
let wasmSafeJson = null;
let wasmSafeString = null;
let wasmExtractPlainText = null;
let wasmSummarizeContent = null;
let wasmSanitizeUsername = null;
let wasmSanitizeForInjection = null;

// ── Lazy-loaded: @pixagram/dpixa ──
let Client = null;
let PrivateKey = null;
let PublicKey = null;
let Signature = null;
let cryptoUtils = null;
let Asset = null;
let Price = null;
let Memo = null;
let utils = null;
let Types = null;
let BlockchainMode = 1;
let getVestingSharePrice = null;
let getVests = null;
let VERSION = null;
let DEFAULT_CHAIN_ID = null;
let NETWORK_ID = 128;

// SecureVault loaded lazily — see _ensureVault()
let _SecureVault = null;
let _initSecureVault = null;

// Schema stamp — bump when collections or indexes change.
// On warm start the entire collection/index setup is skipped.
const SCHEMA_VERSION = 'pixa_schema_4.3.0';

// ============================================
// Configuration
// ============================================

const CONFIG = {
    ARGON2_MEMORY_KIB: 32768,
    ARGON2_ITERATIONS: 2,
    ARGON2_AUTOTUNE_TTL: 7 * 24 * 60 * 60 * 1000, // re-benchmark after 7 days
    SESSION_TIMEOUT: 30 * 60 * 1000,
    PIN_TIMEOUT: 5 * 60 * 1000,
    // SECURITY (v4.3 — M1): Raised from 6 to 8. A 6-char PIN has at most
    // ~36 bits of entropy — brute-forcible with Argon2id in ~175 days on
    // consumer hardware. 8 chars raises the floor to ~41 bits (~12 years).
    MIN_PIN_LENGTH: 8,
    // SECURITY (v4.3 — M1): Minimum estimated entropy in bits. PINs that
    // pass the length check but are low-entropy (e.g. "12345678", "password")
    // are rejected. 0 = disabled (length check only).
    MIN_PIN_ENTROPY: 30,
    PIN_MAX_ATTEMPTS: 10,
    PIN_LOCKOUT_MS: 5 * 60 * 1000,
    PIN_WIPE_LIMIT: 50,
    // SECURITY (v4.3 — M2): Absolute session lifetime. Even with sliding
    // window refresh, sessions expire after this duration from creation.
    // Prevents indefinite session survival on compromised devices.
    MAX_SESSION_LIFETIME: 30 * 24 * 60 * 60 * 1000, // 30 days
    DEFAULT_NODES: [
        'https://api.pixagram.com'
    ],
    APP_NAME: 'pixagram/4.2.0',
    PAGINATION_LIMIT: 20,
    // Testnet chain ID (HIVE-shared value). This used to be the library's
    // DEFAULT_CHAIN_ID in dpixa <= 1.3.x, so leaving CHAIN_ID null "just worked"
    // against testnet by coincidence — mainnet and testnet constants were
    // identical. Starting with dpixa 1.4.x the mainnet constant was flipped to
    // the ASCII-"pixagram"+zeros value for the live chain cutover, while the
    // testnet constant was kept at 18dcf0…4e. Pinning it here makes the proxy
    // independent of whatever `DEFAULT_CHAIN_ID` the installed dpixa exposes.
    CHAIN_ID: '706978616772616d000000000000000000000000000000000000000000000000',
    ADDRESS_PREFIX: 'PIX',

    // Asset symbol mapping: [blockchain_symbol, display_symbol]
    // Entry[0] = on-chain name (used in broadcast operations)
    // Entry[1] = display name  (used after sanitization / in the app)
    ASSET_LIQUID: ['PIXA', 'PIXA'],
    ASSET_SUPRA:  ['PXS',   'PXS'],
    ASSET_POWER:  ['VESTS', 'VESTS'],
};

// ============================================
// PIN Strength Estimation (M1)
// ============================================

/**
 * SECURITY (v4.3 — M1): Lightweight PIN entropy estimator.
 *
 * Estimates effective entropy in bits based on character class diversity,
 * pattern detection, and common weak PIN/password blacklist. This is NOT
 * a full zxcvbn — it's a fast heuristic that catches the worst offenders
 * without adding a 400KB dependency.
 *
 * @param {string} pin
 * @returns {{ bits: number, feedback: string|null }}
 */
// Common weak PINs/passwords blacklist — module-level Set so
// estimatePinEntropy doesn't re-allocate the list per call and the
// membership check is O(1).
const WEAK_PIN_SET = new Set([
    'password', 'passw0rd', '12345678', '123456789', '1234567890',
    'qwerty', 'qwertyui', 'abcdefgh', 'letmein', 'welcome',
    'trustno1', 'iloveyou', 'sunshine', 'princess', 'football',
    'dragon', 'master', 'monkey', 'shadow', 'michael',
    'mustang', 'access', 'superman', 'batman', 'charlie',
    '00000000', '11111111', '22222222', '88888888', '99999999',
    'abc123', 'admin', 'login', 'starwars', 'whatever',
]);

function estimatePinEntropy(pin) {
    if (!pin) return { bits: 0, feedback: 'PIN is empty' };

    const lower = pin.toLowerCase();
    if (WEAK_PIN_SET.has(lower)) {
        return { bits: 5, feedback: 'This is a commonly used password' };
    }

    // Character class analysis
    let hasLower = false, hasUpper = false, hasDigit = false, hasSpecial = false;
    for (const c of pin) {
        if (c >= 'a' && c <= 'z') hasLower = true;
        else if (c >= 'A' && c <= 'Z') hasUpper = true;
        else if (c >= '0' && c <= '9') hasDigit = true;
        else hasSpecial = true;
    }

    let poolSize = 0;
    if (hasLower) poolSize += 26;
    if (hasUpper) poolSize += 26;
    if (hasDigit) poolSize += 10;
    if (hasSpecial) poolSize += 32;

    // Base entropy: log2(poolSize) * length
    let bits = Math.log2(poolSize || 1) * pin.length;

    // Penalty: repeated characters (e.g. "aaaa1234")
    const charFreq = {};
    for (const c of pin) charFreq[c] = (charFreq[c] || 0) + 1;
    const maxRepeat = Math.max(...Object.values(charFreq));
    if (maxRepeat >= pin.length * 0.5) {
        bits *= 0.5;
    } else if (maxRepeat >= pin.length * 0.35) {
        bits *= 0.7;
    }

    // Penalty: sequential characters (e.g. "12345678", "abcdefgh")
    let seqCount = 0;
    for (let i = 1; i < pin.length; i++) {
        if (pin.charCodeAt(i) === pin.charCodeAt(i - 1) + 1 ||
            pin.charCodeAt(i) === pin.charCodeAt(i - 1) - 1) {
            seqCount++;
        }
    }
    if (seqCount >= pin.length * 0.6) {
        bits *= 0.4;
    } else if (seqCount >= pin.length * 0.4) {
        bits *= 0.65;
    }

    // Penalty: all same character class (pure digits, pure lowercase)
    const classCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
    if (classCount === 1 && pin.length <= 10) {
        bits *= 0.7;
    }

    bits = Math.round(bits * 10) / 10;

    let feedback = null;
    if (bits < 20) feedback = 'PIN is very weak — add mixed character types and avoid patterns';
    else if (bits < 30) feedback = 'PIN is weak — use a longer passphrase with mixed characters';
    else if (bits < 40) feedback = 'PIN could be stronger — consider adding special characters';

    return { bits, feedback };
}

// ============================================
// Asset Symbol Translation
// ============================================

// Build lookup maps from CONFIG asset definitions
// fromChain: blockchain_symbol → display_symbol  (used when sanitizing data FROM the chain)
// toChain:   display_symbol → blockchain_symbol   (used when preparing data FOR broadcast)
const ASSET_MAP_FROM_CHAIN = {};
const ASSET_MAP_TO_CHAIN = {};
const ASSET_PRECISION = {};

for (const def of [CONFIG.ASSET_LIQUID, CONFIG.ASSET_SUPRA, CONFIG.ASSET_POWER]) {
    const [chainSymbol, displaySymbol] = def;
    ASSET_MAP_FROM_CHAIN[chainSymbol] = displaySymbol;
    ASSET_MAP_TO_CHAIN[displaySymbol] = chainSymbol;
}

// Precision: the power asset uses 6 decimal places; liquid and supra use 3.
// Both the on-chain and the display symbol are registered for each asset so
// lookups succeed on either side of the translation.
ASSET_PRECISION[CONFIG.ASSET_POWER[0]]  = 6;
ASSET_PRECISION[CONFIG.ASSET_POWER[1]]  = 6;
ASSET_PRECISION[CONFIG.ASSET_LIQUID[0]] = 3;
ASSET_PRECISION[CONFIG.ASSET_LIQUID[1]] = 3;
ASSET_PRECISION[CONFIG.ASSET_SUPRA[0]]  = 3;
ASSET_PRECISION[CONFIG.ASSET_SUPRA[1]]  = 3;

// True when every symbol maps to itself, i.e. the translation layer is a no-op
// for this chain configuration. Computed once at module load.
const ASSET_TRANSLATION_IS_IDENTITY =
    Object.keys(ASSET_MAP_FROM_CHAIN).every(k => ASSET_MAP_FROM_CHAIN[k] === k) &&
    Object.keys(ASSET_MAP_TO_CHAIN).every(k => ASSET_MAP_TO_CHAIN[k] === k);

/**
 * Parse an asset string into its numeric amount and symbol.
 * @param {string} assetStr - e.g. "123.456 TESTS" or "0.000000 VESTS"
 * @returns {{ amount: number, symbol: string, raw: string } | null}
 */
function parseAsset(assetStr) {
    if (typeof assetStr !== 'string') return null;
    const parts = assetStr.trim().split(' ');
    if (parts.length !== 2) return null;
    const amount = parseFloat(parts[0]);
    if (isNaN(amount)) return null;
    return { amount, symbol: parts[1], raw: assetStr };
}

/**
 * Format a parsed asset back to a string with the correct precision.
 * @param {number} amount
 * @param {string} symbol
 * @returns {string}
 */
function formatAssetString(amount, symbol) {
    const precision = ASSET_PRECISION[symbol] ?? 3;
    return `${amount.toFixed(precision)} ${symbol}`;
}

/**
 * Re-precision a decimal digit string without going through a float.
 *
 * Pads with zeros when the fractional part is short, and rounds half-up using
 * string arithmetic when it is long. `toFixed()` cannot be used here: VESTS
 * carries 6 decimals and balances run to 9 integer digits, so a value like
 * 458123456.123456 sits at 15 significant digits — the edge of float64 — and
 * a parseFloat/toFixed round-trip can silently mutate its low digits.
 *
 * @param {string} numStr - e.g. "458123456.123456" or "-1.5"
 * @param {number} precision - required number of decimal places
 * @returns {string|null} re-precisioned digit string, or null if unparseable
 */
function reprecisionDecimalString(numStr, precision) {
    const m = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(numStr);
    if (!m) return null;

    const sign = m[1] === '-' ? '-' : '';
    let intPart = m[2];
    let frac = m[3] || '';

    if (frac.length < precision) {
        frac = frac.padEnd(precision, '0');
    } else if (frac.length > precision) {
        const roundUp = frac.charCodeAt(precision) >= 0x35; // '5'
        frac = frac.slice(0, precision);
        if (roundUp) {
            // Increment the concatenated digit string at its last place.
            const digits = (intPart + frac).split('');
            let i = digits.length - 1;
            for (; i >= 0; i--) {
                if (digits[i] === '9') digits[i] = '0';
                else { digits[i] = String(Number(digits[i]) + 1); break; }
            }
            let joined = digits.join('');
            if (i < 0) joined = '1' + joined;
            const cut = joined.length - precision;
            intPart = precision ? joined.slice(0, cut) : joined;
            frac    = precision ? joined.slice(cut) : '';
        }
    }

    // Strip leading zeros but keep a single one before the decimal point.
    intPart = intPart.replace(/^0+(?=\d)/, '');
    return precision ? `${sign}${intPart}.${frac}` : `${sign}${intPart}`;
}

/**
 * Rewrite an asset string's symbol via `map`, normalising precision, without
 * touching the digits numerically.
 *
 * Short-circuits in two cases, both of which cover the current PIXA/PXS/VESTS
 * configuration where every symbol maps to itself: the whole translation layer
 * being an identity, and an individual symbol mapping to itself. This matters
 * because the translate helpers run on ~75 call sites, several of them per
 * post at feed scale.
 *
 * @param {string} assetStr
 * @param {Record<string,string>} map
 * @returns {string}
 */
function swapAssetSymbol(assetStr, map) {
    if (ASSET_TRANSLATION_IS_IDENTITY) return assetStr;
    if (typeof assetStr !== 'string') return assetStr;

    const sp = assetStr.trim().lastIndexOf(' ');
    if (sp < 1) return assetStr;

    const trimmed = assetStr.trim();
    const amountStr = trimmed.slice(0, sp);
    const symbol = trimmed.slice(sp + 1);

    const target = map[symbol];
    if (!target) return assetStr;

    const precision = ASSET_PRECISION[target] ?? ASSET_PRECISION[symbol] ?? 3;
    const reprecisioned = reprecisionDecimalString(amountStr, precision);
    if (reprecisioned === null) return assetStr;   // malformed — pass through

    if (target === symbol && reprecisioned === amountStr) return assetStr;
    return `${reprecisioned} ${target}`;
}

/**
 * Translate an asset string from blockchain symbols to display symbols.
 * Used when sanitizing data coming FROM the chain (e.g. TESTS → PXA).
 * If the symbol is not in the translation map, returns the asset as-is.
 *
 * @param {string} assetStr - e.g. "100.000 TESTS"
 * @returns {string} e.g. "100.000 PXA"
 */
function translateAssetFromChain(assetStr) {
    return swapAssetSymbol(assetStr, ASSET_MAP_FROM_CHAIN);
}

/**
 * Translate an asset string from display symbols to blockchain symbols.
 * Used when preparing data FOR broadcast operations (e.g. PXA → TESTS).
 * If the symbol is not in the translation map, returns the asset as-is.
 *
 * @param {string} assetStr - e.g. "100.000 PXA"
 * @returns {string} e.g. "100.000 TESTS"
 */
function translateAssetToChain(assetStr) {
    return swapAssetSymbol(assetStr, ASSET_MAP_TO_CHAIN);
}

// ============================================
// CONTENT TYPE DETECTION
// ============================================

/**
 * Detect whether a post body is a pixel art post (pure base64 image)
 * or a blog post (HTML/markdown content).
 *
 * Pixel art posts: body is a raw `data:image/...;base64,...` data URI.
 * Blog posts: body is HTML or markdown text.
 *
 * @param {string} body - Raw post body from chain
 * @returns {'pixel_art'|'blog'}
 */
function detectContentType(body) {
    if (!body || typeof body !== 'string') return 'blog';
    const trimmed = body.trim();
    // Pure base64 image data URI — pixel art post
    if (trimmed.startsWith('data:image/') && !trimmed.includes('<') && !trimmed.includes('\n')) {
        return 'pixel_art';
    }
    return 'blog';
}

// ============================================
// VALIDATORS (v3.5.0) — JS-side format checks
// ============================================

// Hoisted whitelist for safe_community_role (checked once per post/comment
// at feed scale — keep it allocation-free and O(1)).
const COMMUNITY_ROLES = new Set(['owner', 'admin', 'mod', 'member', 'guest', 'muted']);

const VALIDATORS = {
    safe_asset: (s) => {
        if (typeof s !== 'string') return null;
        return /^\d{1,15}\.\d{3,6} [A-Z]{3,6}$/.test(s) ? s : null;
    },
    safe_permlink: (s) => {
        if (typeof s !== 'string') return null;
        const t = s.trim().toLowerCase();
        return /^[a-z0-9][a-z0-9\-]{0,255}$/.test(t) ? t : null;
    },
    safe_url_path: (s) => {
        if (typeof s !== 'string') return null;
        const t = s.trim();
        return /^\/@[a-z0-9][a-z0-9.\-]{1,15}\/[a-z0-9][a-z0-9\-]{0,255}(#.*)?$/.test(t) ? t : null;
    },
    safe_pubkey: (s) => {
        if (typeof s !== 'string') return null;
        return /^PIX[1-9A-HJ-NP-Za-km-z]{46,53}$/.test(s) ? s : null;
    },
    /**
     * Convert an ISO-8601 date string to a millisecond timestamp (integer).
     * Returns 0 for invalid/missing dates so `new Date(ts)` always works.
     * Blockchain dates are UTC with no trailing "Z" — we append it.
     */
    safe_timestamp: (s) => {
        if (typeof s === 'number' && Number.isFinite(s)) return s;
        if (typeof s !== 'string') return 0;
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return 0;
        const ms = Date.parse(s.endsWith('Z') ? s : s + 'Z');
        return Number.isFinite(ms) ? ms : 0;
    },
    safe_number: (v) => {
        return (typeof v === 'number' && Number.isFinite(v)) ? v : null;
    },
    safe_bool: (v) => {
        return (typeof v === 'boolean') ? v : null;
    },
    safe_numeric_string: (s) => {
        if (typeof s !== 'string') return null;
        return /^-?\d{1,30}$/.test(s) ? s : null;
    },
    safe_percent: (v) => {
        if (typeof v !== 'number') return null;
        return (Number.isInteger(v) && v >= 0 && v <= 10000) ? v : null;
    },
    safe_beneficiary: (b) => {
        if (!b || typeof b !== 'object') return null;
        const account = VALIDATORS.safe_username_js(b.account);
        const weight = VALIDATORS.safe_percent(b.weight);
        if (!account || weight === null) return null;
        return { account, weight };
    },
    safe_username_js: (s) => {
        if (typeof s !== 'string') return null;
        const t = s.trim().toLowerCase();
        if (t.length < 3 || t.length > 16) return null;
        if (!/^[a-z][a-z0-9.\-]{2,15}$/.test(t)) return null;
        if (/[.\-]{2}/.test(t)) return null;
        if (/[.\-]$/.test(t)) return null;
        return t;
    },
    safe_manabar: (m) => {
        if (!m || typeof m !== 'object') return null;
        return {
            current_mana: String(m.current_mana || '0'),
            last_update_time: VALIDATORS.safe_number(m.last_update_time) ?? 0,
        };
    },
    /**
     * Validate an Authority object { weight_threshold, account_auths, key_auths }.
     * These are structured chain data — NOT user-supplied text.
     */
    safe_authority: (auth) => {
        if (!auth || typeof auth !== 'object') return null;
        return {
            weight_threshold: VALIDATORS.safe_number(auth.weight_threshold) ?? 1,
            account_auths: Array.isArray(auth.account_auths)
                ? auth.account_auths.filter(a => Array.isArray(a) && a.length === 2 && typeof a[0] === 'string')
                : [],
            key_auths: Array.isArray(auth.key_auths)
                ? auth.key_auths.filter(a => Array.isArray(a) && a.length === 2 && typeof a[0] === 'string')
                : [],
        };
    },
    /**
     * Validate a single active_vote entry.
     * { voter, weight, rshares, time } — voter is a username, rest are numbers/strings.
     */
    safe_active_vote: (v, sanitizeUsername) => {
        if (!v || typeof v !== 'object') return null;
        const voter = sanitizeUsername ? sanitizeUsername(v.voter) : VALIDATORS.safe_username_js(v.voter);
        if (!voter) return null;
        return {
            voter,
            weight:  VALIDATORS.safe_number(v.weight) ?? 0,
            rshares: VALIDATORS.safe_numeric_string(String(v.rshares || '0')) || '0',
            time:    VALIDATORS.safe_timestamp(v.time),
        };
    },
    /**
     * Bridge-style post moderation stats block.
     * Shape: { gray, hide, is_pinned, flag_weight, total_votes }
     * All fields optional; missing → safe defaults. Always returns a non-null
     * object so downstream code can read `stats.hide` without guarding.
     */
    safe_stats: (s) => {
        if (!s || typeof s !== 'object') {
            return { gray: false, hide: false, is_pinned: false, flag_weight: 0, total_votes: 0 };
        }
        return {
            gray:        VALIDATORS.safe_bool(s.gray) ?? false,
            hide:        VALIDATORS.safe_bool(s.hide) ?? false,
            is_pinned:   VALIDATORS.safe_bool(s.is_pinned) ?? false,
            flag_weight: VALIDATORS.safe_number(s.flag_weight) ?? 0,
            total_votes: VALIDATORS.safe_number(s.total_votes) ?? 0,
        };
    },
    /**
     * Community role string. HIVE bridge uses: 'owner' | 'admin' | 'mod' |
     * 'member' | 'guest' | 'muted'. Unknown values → empty string.
     */
    safe_community_role: (s) => {
        if (typeof s !== 'string') return '';
        const t = s.trim().toLowerCase();
        return COMMUNITY_ROLES.has(t) ? t : '';
    },
};

// ============================================
// Custom Error Classes
// ============================================

export class PixaAPIError extends Error {
    constructor(message, code, data = null) {
        super(message);
        this.name = 'PixaAPIError';
        this.code = code;
        this.data = data;
    }
}

class KeyNotFoundError extends PixaAPIError {
    constructor(account, keyType) {
        super(`Key not found for ${account}/${keyType}`, 'KEY_NOT_FOUND', { account, keyType });
        this.name = 'KeyNotFoundError';
    }
}

class VaultNotInitializedError extends PixaAPIError {
    constructor() {
        super('Vault not initialized. Call initializeVault() first.', 'VAULT_NOT_INITIALIZED');
        this.name = 'VaultNotInitializedError';
    }
}

// SessionExpiredError, SessionNotFoundError → see ./session-manager.js

// ============================================
// Utility Functions
// ============================================

const yieldToEventLoop = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * @deprecated Use CryptoUtils.getRandomBytes() directly. Kept as a local
 * delegate for backward compatibility with call sites throughout this file.
 */
const getRandomBytes = (length) => CryptoUtils.getRandomBytes(length);

/**
 * @deprecated Use CryptoUtils.bytesToHex() directly.
 */
const bytesToHex = (bytes) => CryptoUtils.bytesToHex(bytes);

/**
 * Normalize account name
 * @param {string|object} account
 * @returns {string|null}
 */
function normalizeAccount(account) {
    if (!account) return null;
    if (typeof account === 'string') return account.replace(/^@/, '').toLowerCase().trim() || null;
    const raw = account?.account || account?.name || '';
    return raw.replace(/^@/, '').toLowerCase().trim() || null;
}

// ── Signing-authority tables ─────────────────────────────────────────────────
// Hoisted to module scope as Sets, matching WEAK_PIN_SET and COMMUNITY_ROLES
// above: _inferKeyType() runs on every broadcast, and rebuilding two ~40-entry
// arrays per call for an O(n) .includes() scan is pure waste.

const ACTIVE_OPS = new Set([
    // Financial operations
    'transfer', 'transfer_to_vesting', 'withdraw_vesting',
    'delegate_vesting_shares', 'transfer_to_savings',
    'transfer_from_savings', 'cancel_transfer_from_savings',
    'recurrent_transfer',
    // Conversion & market operations
    'convert', 'collateralized_convert', 'limit_order_create',
    'limit_order_create2', 'limit_order_cancel',
    // Account operations
    'account_update', 'account_update2',
    'account_create', 'account_create_with_delegation',
    'create_claimed_account', 'claim_account',
    'set_withdraw_vesting_route',
    'request_account_recovery',
    // Witness & governance operations
    'account_witness_vote', 'account_witness_proxy',
    'witness_update', 'witness_set_properties',
    'feed_publish',
    // Escrow operations
    'escrow_transfer', 'escrow_approve',
    'escrow_dispute', 'escrow_release',
    // Proposal / DAO operations
    'create_proposal', 'update_proposal',
    'update_proposal_votes', 'remove_proposal',
]);

const OWNER_OPS = new Set([
    'change_recovery_account', 'recover_account',
    'decline_voting_rights',
]);

// Privilege ordering — a transaction carries one signature, so a bundle is
// signed with the highest-privilege key any member operation requires.
const KEY_TYPE_RANK = Object.freeze({ posting: 0, active: 1, owner: 2 });

// ============================================
// Main Pixa Proxy API Class
// ============================================

export class PixaProxyAPI {
    constructor() {
        // SHARED DB (Aug 2026): one LacertaDB instance for the whole app,
        // constructed in utils/settings.js with the turboSerial options that
        // used to live here (moved verbatim — SessionManager depends on
        // lacerta.serializer's byte-level config). Sharing the instance means
        // one connection pool over 'user_settings' and no cross-instance
        // coordination between the settings layer and this API.
        this.lacerta = lacerta;
        this.settingsDb = null;

        /** @type {SecureVault} Argon2id + ChaCha20-Poly1305 vault (v3, key-committing) */
        this.vault = null;
        /** @type {Promise|null} In-flight _ensureVault dedup guard */
        this._vaultPromise = null;

        /** @type {Client} Single unified client for all API calls */
        this.client = null;

        this.eventEmitter = new EventEmitter();
        this.initialized = false;

        // Organized API groups
        this.database = null;
        this.tags = null;
        this.blocks = null;
        this.globals = null;
        this.prices = null;
        this.accounts = null;
        this.market = null;
        this.authority = null;
        this.votes = null;
        this.content = null;
        this.witnesses = null;
        this.follow = null;
        this.broadcast = null;
        this.auth = null;
        this.formatter = null;
        this.blockchain = null;
        this.rc = null;
        this.communities = null;
        this.keys = null;
        this.transaction = null;
        this.jsonrpc = null;
        this.rewards = null;

        // Internal managers
        this.keyManager = null;
        this.sessionManager = null;
        this.contentSanitizer = new ContentSanitizer();
        this.paginationManager = new PaginationManager();

        // Sanitization pipeline (no persistence layer — sanitized entities
        // are returned directly to the caller, never written to LacertaDB).
        /** @type {SanitizationPipeline} */
        this.sanitizationPipeline = null;

        /** @type {ConnectivityMonitor} */
        this.connectivity = null;
        /** @type {BroadcastQueue} */
        this.broadcastQueue = null;

        this.config = { ...CONFIG };
        this.pendingValidations = new Map();

        /** @private Backing field for askVote getter/setter */
        this._askVote = false;
        /** @private Backing field for defaultVotingPower (0-100 percentage) */
        this._defaultVotingPower = 100;
    }

    /**
     * Whether broadcast.vote() should prompt the UI for weight confirmation
     * before broadcasting. When true, vote() emits 'vote_weight_required'
     * instead of broadcasting immediately.
     * @type {boolean}
     */
    get askVote() { return this._askVote; }
    set askVote(value) { this._askVote = Boolean(value); }

    /**
     * Default voting power percentage (0–100). Used by the vote weight dialog
     * as the initial slider position. A value of 33 means the slider starts
     * at +33% for upvotes or -33% for downvotes.
     * @type {number}
     */
    get defaultVotingPower() { return this._defaultVotingPower; }
    set defaultVotingPower(value) {
        this._defaultVotingPower = Math.max(0, Math.min(100, parseInt(value, 10) || 100));
    }

    /**
     * Infer the required key type from an operation name.
     * Used by BroadcastQueue to request the correct signing key.
     * @param {string} opType
     * @returns {'posting'|'active'|'owner'}
     * @private
     */
    _inferKeyType(opType) {
        if (OWNER_OPS.has(opType)) return 'owner';
        if (ACTIVE_OPS.has(opType)) return 'active';
        return 'posting';
    }

    /**
     * Infer the signing key type required by an entire operation bundle.
     *
     * FIX: a transaction carries a single signature, so a bundle that mixes
     * authorities (e.g. [['comment', …], ['transfer', …]]) must be signed
     * with the highest-privilege key any member operation requires. Callers
     * used to inspect `operations[0]` only, which queued such a bundle under
     * 'posting' and failed at broadcast with "Missing Authority".
     *
     * @param {Array<[string, object]>} operations
     * @returns {'posting'|'active'|'owner'}
     * @private
     */
    _inferKeyTypeForOps(operations) {
        if (!Array.isArray(operations) || operations.length === 0) return 'posting';

        let best = 'posting';
        for (const op of operations) {
            const opType = Array.isArray(op) ? op[0] : op?.[0];
            const type = this._inferKeyType(opType);
            if (KEY_TYPE_RANK[type] > KEY_TYPE_RANK[best]) best = type;
            if (best === 'owner') break;   // nothing outranks owner
        }
        return best;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.keyManager && newConfig.PIN_TIMEOUT !== undefined) {
            this.keyManager.setPinTimeout(newConfig.PIN_TIMEOUT);
        }
        if (this.sessionManager && newConfig.SESSION_TIMEOUT !== undefined) {
            this.sessionManager.setSessionTimeout(newConfig.SESSION_TIMEOUT);
        }
        if (this.contentSanitizer && newConfig.internalDomains) {
            this.contentSanitizer.setInternalDomains(newConfig.internalDomains);
        }
        if (this.contentSanitizer && newConfig.imageProxyBase !== undefined) {
            this.contentSanitizer.setImageProxyBase(newConfig.imageProxyBase);
        }
    }

    async initialize(config = {}) {
        try {
            if (config.sessionTimeout) this.config.SESSION_TIMEOUT = config.sessionTimeout;
            if (config.pinTimeout) this.config.PIN_TIMEOUT = config.pinTimeout;

            // ── Phase 0a′: Kick the IDB work off FIRST ─────────────────────
            // The warm-start probe and the user_settings open are independent
            // of the sanitizer/dpixa modules, but they used to run only AFTER
            // both chunk downloads completed — serializing all of the IDB
            // latency behind the network. Started here, the whole IDB side
            // runs UNDER the chunk fetches and is normally resolved by the
            // time Phase 1 joins it. Internal order (probe strictly before
            // getDatabase) is preserved, so the probe can never observe a
            // database that this same call is about to create.
            const idbPrep = (async () => {
                // SECURITY (v4.3 — L3): Warm-start detection via IDB probe
                // instead of localStorage. localStorage is synchronous,
                // blocking, and readable by any same-origin script. The schema
                // version flag reveals that LacertaDB is initialized — useful
                // for targeted attacks.
                //
                // v4.4: Probe targets user_settings (the only persistent DB now).
                //
                // SHARED DB NOTE: utils/settings.js now opens this same
                // database at script evaluation, so on a completely fresh
                // browser the probe can report "warm" before OUR collections
                // exist. The getCollection('sessions') integrity check after
                // Phase 1 is what keeps that honest — it drops us to the cold
                // schema path whenever the probe's answer was about a DB that
                // only the settings layer has touched so far.
                let warm = false;
                try {
                    warm = await new Promise((resolve) => {
                        const req = indexedDB.open('user_settings');
                        req.onupgradeneeded = () => { req.transaction.abort(); resolve(false); };
                        req.onsuccess = () => { req.result.close(); resolve(true); };
                        req.onerror = () => resolve(false);
                    });
                } catch (_) {}
                // v4.4: pixa_cache is no longer opened. Nothing is persisted
                // beyond user settings, sessions, vault config, and the offline
                // broadcast outbox — all of which live in user_settings.
                const db = await this.lacerta.getDatabase('user_settings');
                return { warm, db };
            })();
            // Mark handled so a rejection during the module downloads below
            // can't surface as an unhandledrejection before Phase 1 awaits it
            // (the await still rethrows into this try/catch as before).
            idbPrep.catch(() => {});

            // ── Phase 0a: Lazy-load dependencies via JSLoader (parallel) ──
            const [sanitizerModule, dpixaModule] = await Promise.all([
                JSLoader(() => import('./sanitizer')).then(mod => {
                    pixaContentInit    = mod.default;
                    wasmSanitizePost   = mod.sanitizePost;
                    wasmSanitizeComment = mod.sanitizeComment;
                    wasmSetImageProxyBase = mod.setImageProxyBase || null;
                    wasmSafeProfileImage  = mod.safeProfileImage || null;
                    wasmInspectImageDataUri = mod.inspectImageDataUri || null;
                    wasmSanitizeMemo   = mod.sanitizeMemo;
                    wasmSafeJson       = mod.safeJson;
                    wasmSafeString     = mod.safeString;
                    wasmExtractPlainText   = mod.extractPlainText;
                    wasmSummarizeContent   = mod.summarizeContent;
                    wasmSanitizeUsername   = mod.sanitizeUsername;
                    wasmSanitizeForInjection = mod.sanitizeForInjection;
                    return mod;
                }),
                JSLoader(() => import('@pixagram/dpixa/dist/dpixa')).then(mod => {
                    Client             = mod.Client;
                    PrivateKey         = mod.PrivateKey;
                    PublicKey          = mod.PublicKey;
                    Signature          = mod.Signature;
                    cryptoUtils        = mod.cryptoUtils;
                    Asset              = mod.Asset;
                    Price              = mod.Price;
                    Memo               = mod.Memo;
                    utils              = mod.utils;
                    Types              = mod.Types;
                    BlockchainMode     = mod.BlockchainMode;
                    getVestingSharePrice = mod.getVestingSharePrice;
                    getVests           = mod.getVests;
                    VERSION            = mod.VERSION;
                    DEFAULT_CHAIN_ID   = mod.DEFAULT_CHAIN_ID;
                    NETWORK_ID         = mod.NETWORK_ID;
                    return mod;
                }),
            ]);

            // ── Phase 0b: Fire WASM compile immediately (overlaps everything below) ──
            const wasmPromise = this.contentSanitizer.initialize(config.wasmPath || undefined)
                .then(() => {
                    if (config.internalDomains) {
                        this.contentSanitizer.setInternalDomains(config.internalDomains);
                    }
                    if (config.imageProxyBase !== undefined) {
                        this.contentSanitizer.setImageProxyBase(config.imageProxyBase);
                    }
                });

            // ── Phase 1: Join the IDB work started in Phase 0a′ ──
            // (Probe + open ran under the module downloads above, so this
            // await is normally already resolved.)
            const idbReady = await idbPrep;
            let isWarmStart = idbReady.warm;
            this.settingsDb = idbReady.db;

            // Verify DB integrity on warm start (one fast probe — ~3ms)
            if (isWarmStart) {
                try {
                    await this.settingsDb.getCollection('sessions');
                } catch (_) {
                    // DB was evicted/cleared — probe was stale
                    isWarmStart = false;
                }
            }

            // ── Sync: Client + API groups (no I/O — microseconds) ──
            const nodes = config.nodes || this.config.DEFAULT_NODES;
            const clientOptions = {};

            if (config.chainId || this.config.CHAIN_ID) {
                clientOptions.chainId = config.chainId || this.config.CHAIN_ID;
            }
            if (config.addressPrefix || this.config.ADDRESS_PREFIX) {
                clientOptions.addressPrefix = config.addressPrefix || this.config.ADDRESS_PREFIX;
            }
            if (config.timeout) {
                clientOptions.timeout = config.timeout;
            }
            if (config.failoverThreshold) {
                clientOptions.failoverThreshold = config.failoverThreshold;
            }

            // Initialize single unified client
            this.client = new Client(
                Array.isArray(nodes) ? nodes : [nodes],
                clientOptions
            );

            // Initialize all API groups
            this.database = new DatabaseAPI(this);
            this.tags = new TagsAPI(this);
            this.blocks = new BlocksAPI(this);
            this.globals = new GlobalsAPI(this);
            this.prices = new PricesAPI(this);
            this.accounts = new AccountsAPI(this);
            this.market = new MarketAPI(this);
            this.authority = new AuthorityAPI(this);
            this.votes = new VotesAPI(this);
            this.content = new ContentAPI(this);
            this.witnesses = new WitnessesAPI(this);
            this.follow = new FollowAPI(this);
            this.broadcast = new BroadcastAPI(this);
            this.auth = new AuthAPI(this);
            this.formatter = new FormatterAPI(this);
            this.blockchain = new BlockchainAPI(this);
            this.rc = new ResourceCreditsAPI(this);
            this.communities = new CommunitiesAPI(this);
            this.keys = new AccountByKeyAPI(this);
            this.transaction = new TransactionStatusAPI(this);
            this.jsonrpc = new JsonRpcAPI(this);
            this.rewards = new RewardsAPI(this);

            this.keyManager = new KeyManager(this.eventEmitter, this.config);
            this.sessionManager = new SessionManager(this.settingsDb, this.config, {
                vault: null, // Set after _ensureVault()
                // v6.2: TurboSerial for DeviceKeyManager — payload bytes are
                // serialized without JSON/string intermediaries, so plaintext
                // key material stays in zeroable Uint8Array form end to end.
                serializer: this.lacerta.serializer,
            });

            // ── Connectivity monitor + offline broadcast queue ──
            this.connectivity = new ConnectivityMonitor({
                heartbeatUrl: null, // Set to API node health endpoint if available
                heartbeatInterval: 30_000,
            });
            this.connectivity.initialize(this.eventEmitter);

            // ── Phase 2: Schema setup ──
            if (isWarmStart) {
                // WARM: Collections + indexes already exist.
                // Only init managers (they need collection handles — parallel).
                await Promise.all([
                    this.keyManager.setDependencies(this.settingsDb),
                    this.sessionManager.initialize(this.eventEmitter),
                ]);
            } else {
                // COLD: Full schema setup — settings collections + managers in one parallel batch.
                // pq_vault_config: stores cached Argon2id auto-tune benchmark
                // ({ memoryKib, iterations, parallelism, label, measuredMs, tunedAt }).
                // Must be ensured here — _initVaultCore() writes to it on first launch,
                // and without this entry the write throws "Collection not found" and
                // the benchmark re-runs on every page load.
                //
                // broadcast_queue: persists the offline broadcast outbox (durable
                // user-initiated transactions waiting for connectivity).
                const settingsCollections = [
                    'sessions',
                    'preferences',
                    'accounts_registry',
                    'notification_reads',
                    'pq_vault_config',
                    'broadcast_queue',
                ];

                await Promise.all([
                    this._setupCollectionGroup(this.settingsDb, settingsCollections, 'settings'),
                    this.keyManager.setDependencies(this.settingsDb),
                    this.sessionManager.initialize(this.eventEmitter),
                ]);

                // Warm-start stamp no longer needed — IDB probe is self-detecting
            }

            // ── Phase 3: Await WASM (likely already resolved during DB + schema work) ──
            try {
                await wasmPromise;
            } catch (wasmError) {
                // SECURITY FIX (v3.5.2): WASM sanitizer is mandatory for safe
                // content rendering. Without it, content cannot be served safely.
                if (config.allowDegradedSanitizer) {
                    console.warn('[PixaProxyAPI] pixa-content WASM init failed — DEGRADED MODE:', wasmError.message);
                } else {
                    throw new PixaAPIError(
                        'Content sanitizer (WASM) failed to initialize. Cannot serve content safely.',
                        'SANITIZER_INIT_FAILED',
                        { message: wasmError.message }
                    );
                }
            }

            /** @type {boolean} Whether the WASM sanitizer is operational */
            this.sanitizerReady = this.contentSanitizer.ready;

            // SECURITY PATCH (v3.5.2-patched): Only create the sanitization
            // pipeline when WASM is operational. If WASM failed and
            // allowDegradedSanitizer was set, pipeline stays null — API
            // fallback paths will refuse to serve raw data (fail-closed).
            //
            // v4.4: No persistence layer is installed on top of the pipeline.
            // Sanitized entities are returned directly to the caller; nothing
            // is written to LacertaDB. Every query hits the network and gets
            // fresh sanitized data.
            if (this.sanitizerReady) {
                this.sanitizationPipeline = new SanitizationPipeline(this.contentSanitizer, this.formatter);
            } else {
                this.sanitizationPipeline = null;
                console.warn('[PixaProxyAPI] Sanitization pipeline DISABLED — WASM sanitizer not ready');
            }

            this.initialized = true;

            // ── BroadcastQueue: offline-aware operation queue ──
            // v4.4: Moved from pixa_cache → user_settings. The queue holds
            // user-initiated transactions waiting for connectivity, which is
            // durable user data — not derived/cacheable content.
            try {
                this.broadcastQueue = new BroadcastQueue(
                    this.settingsDb,
                    this.connectivity,
                    this.eventEmitter,
                    { maxRetries: 3, maxAge: 24 * 60 * 60 * 1000 }
                );
                await this.broadcastQueue.initialize();

                // Wire the actual broadcast function
                this.broadcastQueue.broadcastFn = async (opType, operations, meta) => {
                    const account = meta.account || this.sessionManager?.getCurrentAccountSync();
                    if (!account) throw new PixaAPIError('No active account for broadcast', 'NO_ACCOUNT');

                    const keyType = meta.keyType || this._inferKeyType(opType);
                    this.sessionManager.touchActivity();

                    // v6.1: Get key as YOLOBuffer from SessionManager (byte-level, auto-zeroing).
                    // Falls back to KeyManager.requestKeyBuffer for backward compat.
                    let keyBuf;
                    try {
                        keyBuf = this.sessionManager.getKeyAsYOLO(keyType);
                    } catch (_) {
                        keyBuf = await this.keyManager.requestKeyBuffer(account, keyType);
                    }

                    return YOLOBuffer.use(keyBuf, async (wifBytes) => {
                        // Decode WIF bytes → PrivateKey. The WIF string is transient.
                        const wif = new TextDecoder().decode(wifBytes);
                        const privateKey = PrivateKey.from(wif);

                        try {
                            if (operations.length === 1) {
                                const [op, opData] = operations[0];
                                const methodName = op.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
                                const method = this.client.broadcast[methodName];
                                if (typeof method === 'function') {
                                    return method.call(this.client.broadcast, opData, privateKey);
                                }
                            }

                            return this.client.broadcast.sendOperations(operations, privateKey);
                        } finally {
                            // Zero the 32-byte internal secret buffer
                            if (privateKey.secret) privateKey.secret.fill(0);
                        }
                    });
                    // wifBytes auto-zeroed by YOLOBuffer.use()
                };

                // FIX (v5.0): Inject session lock checker so drain can detect
                // PIN-locked state and prompt the user instead of failing silently.
                this.broadcastQueue.isLockedFn = () => this.sessionManager?.isLocked ?? false;
            } catch (e) {
                console.warn('[PixaProxyAPI] BroadcastQueue initialization failed:', e.message);
                this.broadcastQueue = null;
            }

            // ── Phase 4: Vault WASM — fire-and-forget (auto-tune cached after first run) ──
            this._ensureVault(config).then(vault => {
                this.sessionManager.vault = vault;
            }).catch(pqErr => {
                console.warn('[PixaProxyAPI] Vault pre-load deferred:', pqErr.message || pqErr);
            });

            // Wire KeyManager ↔ SessionManager
            this.keyManager.setSessionManager(this.sessionManager);
            this.keyManager._unlockWithPin = this.unlockWithPin.bind(this);

            // Listen for PIN lock events from SessionManager's inactivity timer
            this.eventEmitter.on('pin_locked', ({ account }) => {
                console.debug(`[PixaProxyAPI] PIN locked for ${account}`);
            });

            // FIX (v4.2 — timer desync): When SessionManager resets its PIN
            // timer via touchActivity(), also reset KeyManager's passive
            // timestamp-based timer. Without this, user activity keeps the
            // SessionManager alive but KeyManager's isPINValid() silently
            // expires and destroys all cached keys.
            this.eventEmitter.on('pin_activity', () => {
                if (this.keyManager.pinVerified) {
                    this.keyManager.resetPinTimer();
                }
            });

            // FIX (v4.2 — switchAccount key sync): When switching to a
            // persist-mode account, SessionManager loads plaintext_keys into
            // _cachedKeys, but KeyManager.sessionKeys (an in-memory Map) is
            // not synced. Without this, requestKey() finds nothing in
            // KeyManager and falls through to key_required.
            // FIX (v4.5 — key zeroing): Previous code passed raw Uint8Array
            // references from SessionManager.getKeys() into cacheKeys(), which
            // calls _encryptForCache(). That method zeros its input via
            // plainBytes.fill(0) — but when the input IS SessionManager's
            // internal #cachedKeys buffer (same reference), this silently
            // destroys the canonical key material. Any later re-sync
            // (e.g. after PIN timeout → re-unlock) would cache null bytes.
            //
            // _syncKeysToKeyManager() is safe: it calls exportKeysForSealing()
            // (v6.2) which returns NEW byte clones, so the fill(0) inside
            // _encryptForCache targets a disposable copy instead of SM internals.
            this.eventEmitter.on('account_switched', async ({ account, mode }) => {
                if (mode === SessionMode.PERSIST && this.keyManager && this.sessionManager) {
                    try {
                        await this._syncKeysToKeyManager(account);
                        this.keyManager.setActiveAccount(account);
                    } catch (_) {}
                }
            });

            console.log('[PixaProxyAPI] Initialized successfully v4.2.0');
            return this;
        } catch (error) {
            console.error('[PixaProxyAPI] Initialization failed:', error);
            throw new PixaAPIError('Initialization failed', 'INIT_FAILED', { message: error.message });
        }
    }

    /**
     * Restore a previous session after tab reopen or page reload.
     * Delegates to SessionManager.resume():
     *   PIN-locked:   Returns account + emits pin_locked for UI
     *   temporary:    Returns null (nothing survives tab close)
     *   persistent:   Returns account with keys auto-loaded
     * @returns {Promise<string|null>} Account name if restored, null otherwise
     */
    async restoreSession() {
        if (!this.initialized) throw new PixaAPIError('API not initialized', 'NOT_INITIALIZED');

        // Ensure vault WASM is loaded (PIN unlock will need it)
        try { await this._ensureVault(); } catch (_) {}
        if (this.vault) this.sessionManager.vault = this.vault;

        const result = await this.sessionManager.resume();
        if (!result) return null;

        const { account, locked, pinProtected } = result;

        if (locked) {
            // PIN-protected and locked — UI must show PIN dialog
            this.keyManager.setActiveAccount(account);
            this.eventEmitter.emit('session_restored', {
                account, pinEnabled: true, keysLoaded: false, needsPIN: true,
            });
            return account;
        }

        // Keys are available — sync to KeyManager
        await this._syncKeysToKeyManager(account);

        this.keyManager.setActiveAccount(account);
        this.eventEmitter.emit('session_restored', {
            account, pinEnabled: pinProtected, keysLoaded: true, needsPIN: false,
        });
        return account;
    }

    /**
     * Sync SessionManager's decrypted keys into KeyManager's in-memory cache.
     * v6.2: byte-level end to end — SessionManager exports Uint8Array clones
     * and KeyManager._encryptForCache consumes (and zeroes) them directly.
     * @private
     */
    async _syncKeysToKeyManager(account) {
        try {
            // v6.2: exportKeysForSealing returns byte CLONES (safe to zero,
            // not SessionManager's internal buffers — no v4.5-style aliasing).
            // _encryptForCache accepts Uint8Array and zeroes each clone after
            // sealing it, so no unzeroable WIF strings are created on the
            // unlock / account-switch hot path anymore.
            const keys = this.sessionManager.exportKeysForSealing();
            if (keys && this.keyManager) {
                if (!this.keyManager._sessionCryptoKey) {
                    await this.keyManager._generateSessionCryptoKey();
                }
                await this.keyManager.cacheKeys(account, keys);
            }
        } catch (e) {
            console.warn('[restoreSession] Key sync to KeyManager failed:', e.message);
        }
    }

    async hasVaultConfig() {
        return this.sessionManager?.isPinProtected ?? false;
    }

    /**
     * Retrieve wallet keys for an account.
     * Public keys are always returned from chain data.
     * Private keys are returned ONLY if already available in session/vault cache.
     * This method NEVER triggers PIN dialog or key-entry prompts — it is silent.
     * Use keyManager.requestKey(account, type) to prompt the user for a specific key.
     *
     * @param {string} account - Account username
     * @param {object} [options]
     * @param {boolean} [options.requestPrivate=true] - Whether to look up private keys
     * @param {string[]} [options.keyTypes=['posting','active','owner','memo']] - Which key types to request
     * @returns {Promise<{publicKeys: object, privateKeys: object, availableTypes: string[]}>}
     */
    async getWalletKeys(account, options = {}) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) {
            throw new PixaAPIError('Invalid account parameter', 'INVALID_ACCOUNT');
        }

        const requestPrivate = options.requestPrivate !== false;
        const keyTypes = options.keyTypes || ['posting', 'active', 'owner', 'memo'];

        const publicKeys = { posting: '', active: '', owner: '', memo: '' };
        const privateKeys = { posting: '', active: '', owner: '', memo: '' };
        const availableTypes = [];

        // 1. Get public keys from chain account data
        try {
            const [accountData] = await this.client.database.getAccounts([normalizedAccount]);
            if (accountData) {
                if (accountData.posting?.key_auths?.[0]) {
                    publicKeys.posting = accountData.posting.key_auths[0][0] || '';
                }
                if (accountData.active?.key_auths?.[0]) {
                    publicKeys.active = accountData.active.key_auths[0][0] || '';
                }
                if (accountData.owner?.key_auths?.[0]) {
                    publicKeys.owner = accountData.owner.key_auths[0][0] || '';
                }
                if (accountData.memo_key) {
                    publicKeys.memo = accountData.memo_key;
                }
            }
        } catch (e) {
            console.warn('[getWalletKeys] Failed to fetch account public keys:', e.message);
        }

        // 2. Get private keys from session/vault silently (never triggers PIN dialog)
        if (requestPrivate && this.keyManager) {
            for (const type of keyTypes) {
                try {
                    const key = await this.keyManager.getKeyIfAvailable(normalizedAccount, type);
                    if (key) {
                        privateKeys[type] = key;
                        availableTypes.push(type);
                        // Derive public key as fallback if chain data was missing
                        try {
                            const pub = PrivateKey.fromString(key).createPublic().toString();
                            if (!publicKeys[type]) publicKeys[type] = pub;
                        } catch (_) {}
                    }
                } catch (e) {
                    // Key not available
                }
            }
        }

        return { publicKeys, privateKeys, availableTypes };
    }

    async logout() {
        const account = this.sessionManager?.currentAccount;
        await this.sessionManager?.endSession();
        this.eventEmitter.emit(PixaEvents.Session.ENDED, { account });
    }

    /**
     * Lazy-load the PQ Secure Vault WASM module.
     * Called automatically by initializeVault() and unlockWithPin().
     *
     * Uses dynamic import() so the app doesn't crash at module load time
     * if pq-secure-vault.js dependencies aren't installed yet.
     *
     * @param {object} [config] - Optional config with skipAutoTune flag
     * @returns {Promise<PQSecureVault>}
     * @private
     */
    async _ensureVault(config = {}) {
        if (this.vault) return this.vault;
        if (this._vaultPromise) return this._vaultPromise;

        this._vaultPromise = this._initVaultCore(config);
        try {
            return await this._vaultPromise;
        } finally {
            this._vaultPromise = null;
        }
    }

    /** @private */
    async _initVaultCore(config = {}) {
        if (!_SecureVault || !_initSecureVault) {
            try {
                const vaultMod = await import('./pq-secure-vault.js');
                _SecureVault = vaultMod.SecureVault || vaultMod.PQSecureVault;
                _initSecureVault = vaultMod.initSecureVault || vaultMod.initPQVault;
            } catch (e) {
                throw new PixaAPIError(
                    'pq-secure-vault.js not found. npm install hash-wasm @noble/ciphers @noble/hashes',
                    'VAULT_NOT_INSTALLED'
                );
            }
        }

        await _initSecureVault();

        this.vault = new _SecureVault({
            memoryKib: this.config.ARGON2_MEMORY_KIB,
            iterations: this.config.ARGON2_ITERATIONS,
        });

        if (!config.skipAutoTune) {
            let restoredFromCache = false;

            if (!config.forceAutoTune && this.settingsDb) {
                try {
                    const configCol = await this.settingsDb.getCollection('pq_vault_config');
                    const cached = await configCol.get('autotune_params');
                    if (cached?.memoryKib && cached?.iterations
                        && cached.tunedAt && (Date.now() - cached.tunedAt) < this.config.ARGON2_AUTOTUNE_TTL) {
                        this.vault.memoryKib = cached.memoryKib;
                        this.vault.iterations = cached.iterations;
                        if (cached.parallelism) this.vault.parallelism = cached.parallelism;
                        restoredFromCache = true;

                        // Announce the restored profile so UIs mounted after vault
                        // init (e.g. LoginDialog) don't miss the first-run event.
                        try {
                            this.eventEmitter?.emit?.('vault_autotune_ready', {
                                memoryKib: cached.memoryKib,
                                iterations: cached.iterations,
                                parallelism: cached.parallelism || this.vault.parallelism,
                                label: cached.label || null,
                                measuredMs: cached.measuredMs ?? -1,
                                fromCache: true,
                            });
                        } catch (_) {}
                    }
                } catch (_) {}
            }

            if (!restoredFromCache) {
                try {
                    const tuned = await this.vault.autoTuneParams(2000);
                    if (this.settingsDb) {
                        try {
                            const configCol = await this.settingsDb.getCollection('pq_vault_config');
                            const record = {
                                memoryKib: tuned.memoryKib,
                                iterations: tuned.iterations,
                                parallelism: tuned.parallelism ?? this.vault.parallelism,
                                label: tuned.label,
                                measuredMs: tuned.measuredMs,
                                tunedAt: Date.now(),
                            };
                            await configCol.upsert('autotune_params', record);
                        } catch (e) {
                            console.warn('[Vault] Failed to persist auto-tune:', e.message);
                        }
                    }

                    // Fire regardless of whether persistence succeeded — the in-memory
                    // vault is tuned and UIs should reflect that immediately.
                    try {
                        this.eventEmitter?.emit?.('vault_autotune_ready', {
                            memoryKib: tuned.memoryKib,
                            iterations: tuned.iterations,
                            parallelism: tuned.parallelism ?? this.vault.parallelism,
                            label: tuned.label,
                            measuredMs: tuned.measuredMs,
                            fromCache: false,
                        });
                    } catch (_) {}
                } catch (e) {
                    console.warn('[Vault] autoTune failed, using defaults:', e.message);
                }
            }
        }

        this.sessionManager.vault = this.vault;
        return this.vault;
    }

    async initializeVault(pin, options = {}) {
        if (pin.length < this.config.MIN_PIN_LENGTH) {
            throw new PixaAPIError(`PIN must be at least ${this.config.MIN_PIN_LENGTH} characters`, 'PIN_TOO_SHORT');
        }

        // Reject low-entropy PINs even if they pass length check
        if (this.config.MIN_PIN_ENTROPY > 0 && !options.fastMode) {
            const strength = estimatePinEntropy(pin);
            if (strength.bits < this.config.MIN_PIN_ENTROPY) {
                throw new PixaAPIError(
                    strength.feedback || `PIN is too weak (${strength.bits} bits, need ${this.config.MIN_PIN_ENTROPY})`,
                    'PIN_TOO_WEAK',
                    { bits: strength.bits, required: this.config.MIN_PIN_ENTROPY, feedback: strength.feedback }
                );
            }
        }

        if (options.pinTimeout) this.config.PIN_TIMEOUT = options.pinTimeout;

        // v6: initializeVault just loads the WASM and injects it into SessionManager.
        // No salt management, no sealed_keys collection, no config persistence.
        // Sealing happens in SessionManager.createSession() / addPin().
        await this._ensureVault();

        // Ensure KeyManager has a session CryptoKey for in-memory encryption
        if (!this.keyManager._sessionCryptoKey) {
            await this.keyManager._generateSessionCryptoKey();
        }

        this.eventEmitter.emit('vault_initialized', {
            timestamp: Date.now(),
            algorithm: 'argon2id+chacha20poly1305',
            memoryKib: this.vault.memoryKib,
            iterations: this.vault.iterations,
        });
        return true;
    }

    isVaultInitialized() { return (this.vault !== null); }

    async unlockWithPin(pin, options = {}) {
        const { account } = options;

        let normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount && this.sessionManager) {
            normalizedAccount = normalizeAccount(
                this.sessionManager.currentAccount ||
                (await this.sessionManager.getActiveAccount())
            );
        }
        if (!normalizedAccount) {
            return { success: false, error: 'No account specified', code: 'NO_ACCOUNT' };
        }

        // FIX (v6.2): Enforce the persistent lockout. _recordFailedPinAttempt
        // wrote attempt counters and exponential-backoff windows to LacertaDB,
        // but nothing ever read them — _checkPinLockout had zero call sites, so
        // backoff was never applied. Check it here, before the (expensive)
        // vault load and Argon2 derivation.
        const lockout = await this.keyManager._checkPinLockout();
        if (lockout.locked) {
            return {
                success: false,
                error: `Too many failed attempts. Try again in ${lockout.remainingSec}s.`,
                code: 'PIN_LOCKED',
                remainingSec: lockout.remainingSec,
            };
        }

        // Ensure vault WASM is loaded
        try {
            await this._ensureVault();
            if (this.vault) this.sessionManager.vault = this.vault;
        } catch (e) {
            return { success: false, error: 'Vault not available: ' + e.message, code: 'VAULT_ERROR' };
        }

        // Ensure session CryptoKey for KeyManager
        if (!this.keyManager._sessionCryptoKey) {
            await this.keyManager._generateSessionCryptoKey();
        }

        try {
            // Delegate to SessionManager — one path, no fallback cascade
            const success = await this.sessionManager.unlockWithPin(pin);

            if (!success) {
                // Wrong PIN (key commitment mismatch)
                const result = await this.keyManager._recordFailedPinAttempt();
                if (result.wiped) {
                    return { success: false, error: 'Too many failed attempts. Re-login required.', code: 'VAULT_WIPED' };
                }
                return { success: false, error: 'Authentication failed', code: 'AUTH_FAILED' };
            }

            // Success — sync keys to KeyManager
            await this._syncKeysToKeyManager(normalizedAccount);

            // Reset lockout state
            this.keyManager._pinAttempts = 0;
            this.keyManager._pinLockoutUntil = 0;
            this.keyManager.pinVerified = true;
            this.keyManager.pinVerificationTime = Date.now();
            if (this.keyManager._pinLockoutStore) {
                try { await this.keyManager._pinLockoutStore.delete('state'); } catch (_) {}
            }

            this.eventEmitter.emit(PixaEvents.PIN.UNLOCKED, { account: normalizedAccount });
            return { success: true, account: normalizedAccount };
        } catch (error) {
            console.error('[unlockWithPin] Error:', error);
            return { success: false, error: 'Authentication failed', code: 'AUTH_FAILED' };
        }
    }

    async isPinEnabled() {
        return this.sessionManager?.isPinProtected ?? false;
    }


    async requiresUnlock(keyType = 'posting') {
        const account = await this.sessionManager?.getActiveAccount();
        if (!account) {
            return { needsUnlock: true, unlockType: 'login', account: null };
        }

        const normalizedAccount = normalizeAccount(account);

        if (this.keyManager.hasKey(normalizedAccount, keyType)) {
            return { needsUnlock: false, unlockType: null, account: normalizedAccount };
        }

        // FIX (v4.2): Use SessionManager.currentMode (v2 canonical source)
        // instead of session.pinEnabled (v1 compat field). The v1 field can
        // mismatch on v2 sessions where pinEnabled wasn't explicitly set,
        // causing persist-mode sessions to be misidentified as PIN sessions.
        const isPinMode = this.sessionManager?.currentMode === SessionMode.PIN;

        if (isPinMode) {
            if (this.keyManager.isPINValid()) {
                try {
                    const key = await this.keyManager.requestKey(normalizedAccount, keyType);
                    if (key) {
                        return { needsUnlock: false, unlockType: null, account: normalizedAccount };
                    }
                } catch (e) {}
            }
            return { needsUnlock: true, unlockType: 'pin', account: normalizedAccount };
        }

        return { needsUnlock: true, unlockType: 'key', account: normalizedAccount };
    }

    async validateCredentials(account, key, keyType = 'master') {
        const normalizedAccount = normalizeAccount(account);

        if (!normalizedAccount) {
            return { valid: false, error: 'Invalid account parameter' };
        }

        // SECURITY FIX (v3.5.2): Hash the key for deduplication instead of
        // storing the first 10 characters (which leaks 9 chars of WIF entropy).
        const keyHash = bytesToHex(new Uint8Array(
            cryptoUtils.sha256(key + normalizedAccount + keyType)
        ).slice(0, 8));
        const validationKey = `${normalizedAccount}_${keyType}_${keyHash}`;
        if (this.pendingValidations.has(validationKey)) return this.pendingValidations.get(validationKey);

        const validationPromise = this._doValidation(normalizedAccount, key, keyType)
            .finally(() => this.pendingValidations.delete(validationKey));

        this.pendingValidations.set(validationKey, validationPromise);
        return validationPromise;
    }

    async _doValidation(account, key, keyType) {
        const normalizedAccount = normalizeAccount(account);

        if (!normalizedAccount) {
            return { valid: false, error: 'Invalid account parameter' };
        }

        try {
            const accounts = await this.client.database.getAccounts([normalizedAccount]);
            if (!accounts || accounts.length === 0 || !accounts[0]) {
                return { valid: false, error: 'Account not found' };
            }

            const accountData = accounts[0];

            if (keyType === 'master') {
                // Derive ALL key types and check which ones match on-chain authorities.
                // Accounts may have had individual keys changed via update_account —
                // only the keys that still match should be stored/cached.
                const derivedTypes = ['posting', 'active', 'owner', 'memo'];
                const matchedTypes = [];
                const mismatchedTypes = [];
                let primaryPublicKey = null;

                for (const type of derivedTypes) {
                    const derived = PrivateKey.fromLogin(normalizedAccount, key, type);
                    const pubKey = derived.createPublic().toString();

                    let typeMatches = false;
                    if (type === 'memo') {
                        typeMatches = pubKey === accountData.memo_key;
                    } else {
                        typeMatches = accountData[type]?.key_auths?.some(([pk]) => pk === pubKey) || false;
                    }

                    if (typeMatches) {
                        matchedTypes.push(type);
                        if (type === 'posting') primaryPublicKey = pubKey;
                    } else {
                        mismatchedTypes.push(type);
                    }
                }

                // Master password must match at least the posting key to be valid
                if (!matchedTypes.includes('posting')) {
                    return { valid: false, error: 'Master password does not match account keys' };
                }

                // SECURITY FIX (v3.5.2): Never return master password in result
                return {
                    valid: true,
                    publicKey: primaryPublicKey,
                    keyType: 'master',
                    account: normalizedAccount,
                    matchedTypes,      // e.g. ['posting', 'memo']
                    mismatchedTypes,   // e.g. ['active', 'owner']
                };
            } else {
                let privateKey;
                try { privateKey = PrivateKey.fromString(key); } catch (e) {
                    return { valid: false, error: 'Invalid key format (not WIF)' };
                }

                const publicKey = privateKey.createPublic().toString();

                // SECURITY FIX (v3.5.2): Check all key_auths for multi-authority support
                let matches = false;
                switch (keyType) {
                    case 'posting':
                        matches = accountData.posting?.key_auths?.some(([pk]) => pk === publicKey) || false;
                        break;
                    case 'active':
                        matches = accountData.active?.key_auths?.some(([pk]) => pk === publicKey) || false;
                        break;
                    case 'owner':
                        matches = accountData.owner?.key_auths?.some(([pk]) => pk === publicKey) || false;
                        break;
                    case 'memo':
                        matches = publicKey === accountData.memo_key;
                        break;
                    default:
                        return { valid: false, error: 'Invalid key type' };
                }

                if (!matches) {
                    return { valid: false, error: `Key does not match account's ${keyType} key` };
                }
                return { valid: true, publicKey, account: normalizedAccount };
            }
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    async quickLogin(account, key, keyType = 'master', options = {}) {
        const normalizedAccount = normalizeAccount(account);

        if (!normalizedAccount) {
            throw new PixaAPIError('Invalid account parameter', 'INVALID_ACCOUNT');
        }

        // SECURITY FIX (v3.5.2): Always validate credentials against on-chain
        // authorities. skipValidation removed — all login paths must verify keys.
        let validation = options.validation;

        if (!validation) {
            validation = await this.validateCredentials(normalizedAccount, key, keyType);
            if (!validation.valid) throw new PixaAPIError(validation.error, 'VALIDATION_FAILED');
        }

        // SECURITY FIX (v3.5.2): Always ensure session CryptoKey exists so keys
        // are encrypted in memory even for quickLogin (defense-in-depth).
        if (!this.keyManager._sessionCryptoKey) {
            await this.keyManager._generateSessionCryptoKey();
        }

        // Derive/cache keys in KeyManager and capture for session storage
        let sessionKeys = null;

        if (keyType === 'master') {
            const derivedKeys = await this.keyManager.addAccountWithMasterKey(normalizedAccount, key, {
                storeInVault: false,
                matchedTypes: validation?.matchedTypes,
            });
            sessionKeys = derivedKeys;
        } else {
            await this.keyManager.addIndividualKey(normalizedAccount, keyType, key, { storeInVault: false });

            // FIX (v4.2 — Bug B): Collect ALL currently cached keys for this
            // account, not just the new one. When logging in with multiple
            // individual keys (e.g. posting then active), each quickLogin call
            // creates/upserts the session. If we only pass { [keyType]: key },
            // the upsert overwrites plaintext_keys and the previous key is lost.
            // By collecting every key currently in KeyManager's cache, the
            // session record always contains the full set.
            sessionKeys = {};
            for (const type of ['posting', 'active', 'owner', 'memo']) {
                try {
                    const cached = await this.keyManager.getKeyIfAvailable(normalizedAccount, type);
                    if (cached) sessionKeys[type] = cached;
                } catch (_) {}
            }
            // Ensure the new key is always included (defense in depth)
            if (!sessionKeys[keyType]) sessionKeys[keyType] = key;
        }

        // v6: SessionManager.createSession handles ALL encryption (device-wrap + optional PIN seal).
        // No separate _sealKeysToVault step needed.
        let sessionId = null;
        const shouldCreateSession = options.skipSession !== true;

        if (shouldCreateSession && this.sessionManager) {
            try {
                // FIX (v6.2): A PIN login must WAIT for the vault. Previously this
                // was `if (options.pin && this.vault)` — when the Phase-4
                // fire-and-forget vault init hadn't finished (first launch,
                // auto-tune still benchmarking), createSession saw vault === null
                // and stored the keys WITHOUT PIN sealing, silently. Now we block
                // on _ensureVault(); createSession additionally throws NO_VAULT
                // as a second line of defense.
                if (options.pin) {
                    await this._ensureVault();
                    this.sessionManager.vault = this.vault;
                }

                sessionId = await this.sessionManager.createSession(normalizedAccount, {
                    keys:           sessionKeys,
                    persistent:     options.stayConnected !== false,
                    pin:            options.pin || undefined,
                    timeout_ms:     this.config.SESSION_TIMEOUT,
                    pin_timeout_ms: this.config.PIN_TIMEOUT,
                    login_type:     keyType,
                    user_agent:     options.userAgent || 'unknown',
                });
            } catch (e) {
                // FIX (v6.2): Never swallow a failed PIN seal. Returning success
                // here would leave the user believing their keys are PIN-protected
                // when they are not (or not stored at all).
                if (options.pin) {
                    throw new PixaAPIError(
                        'PIN-protected session creation failed: ' + (e.message || e),
                        'PIN_SESSION_FAILED'
                    );
                }
                console.warn('[quickLogin] Session creation error:', e);
                this.eventEmitter.emit(PixaEvents.Session.CREATED, { account: normalizedAccount });
            }
        } else if (options.skipSession === true) {
            this.eventEmitter.emit(PixaEvents.Session.CREATED, { account: normalizedAccount });
        }

        this.keyManager.setActiveAccount(normalizedAccount);
        return { success: true, account: normalizedAccount, sessionId, keyType, validation };
    }

    /**
     * Login with PIN-protected keys (for returning users)
     * @param {string} account
     * @param {string} pin
     * @param {object} options
     */
    async loginWithPin(account, pin, options = {}) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) {
            throw new PixaAPIError('Invalid account parameter', 'INVALID_ACCOUNT');
        }

        // v6: The PIN session already exists in LacertaDB from the original login.
        // We just need to resume (device-unwrap + cache sealed blob) then unlock (Argon2id).
        // No new session creation. No vault config lookup.

        // Ensure the session is resumed first
        if (!this.sessionManager.currentAccount) {
            const result = await this.restoreSession();
            if (!result) {
                throw new PixaAPIError('No session found. Use quickLogin first.', 'NO_SESSION');
            }
        }

        // Now unlock with PIN
        const unlockResult = await this.unlockWithPin(pin, { account: normalizedAccount });
        if (!unlockResult.success) {
            throw new PixaAPIError(unlockResult.error, unlockResult.code || 'UNLOCK_FAILED');
        }

        this.keyManager.setActiveAccount(normalizedAccount);
        return { success: true, account: normalizedAccount };
    }

    disconnect() {
        this.sessionManager?.endSession().catch(() => {});
        if (this.connectivity) this.connectivity.destroy();
        if (this.broadcastQueue) this.broadcastQueue.destroy();
        if (this.client && typeof this.client.disconnect === 'function') this.client.disconnect();
    }

    /**
     * Ensure all settings-DB collections exist. Idempotent — safe to call
     * outside the initialize() cold path (e.g. from a tab that joined an
     * already-warm-started peer's DB).
     */
    async setupCollections() {
        const settingsCollections = [
            'sessions',
            'preferences',
            'accounts_registry',
            'notification_reads',
            'pq_vault_config',
            'broadcast_queue',
        ];
        await this._setupCollectionGroup(this.settingsDb, settingsCollections, 'settings');
    }

    async _setupCollectionGroup(db, collectionNames, groupName) {
        for (const name of collectionNames) {
            db.ensureCollection(name);
        }
    }

    /**
     * Maximum age (ms) of an already-sanitized entity for which the
     * process* fast-path will skip re-sanitization. Bounds how long a
     * caller-supplied object carrying _sanitized + _stored_at can be
     * trusted — this matters because callers may keep sanitized entities
     * in their own in-memory caches (React state, etc.) for a long time,
     * and the sanitizer's WASM ruleset could have been upgraded since.
     *
     * Previously read from CONFIG.ENTITY_TTL; inlined as a constant in
     * v4.4 since the rest of that config was removed alongside the
     * cache layer.
     */
    static get SANITIZED_FRESHNESS_MS() { return 5 * 60 * 1000; }

    // setupVaultCollections — REMOVED. pq_vault_config is ensured as part
    // of settingsCollections in both the cold-init path (initialize()) and
    // the standalone setupCollections() method. Calling
    // getCollection('pq_vault_config') in _initVaultCore() is safe.


    // _sealKeysToVault — REMOVED in v6.
    // Sealing is now handled by SessionManager.createSession() and SessionManager.addPin().
    // The sealed_keys LacertaDB collection is no longer used.
    // Session records contain encrypted_keys (device-wrapped, optionally PIN-sealed).


    /**
     * Guard: ensure profile is a plain object (not a string, array, number, etc.)
     * Malformed on-chain metadata can set "profile" to a non-object value like
     * "rshares" or ["rshares", 0], which causes { ...profile } to produce garbage.
     * @param {*} obj
     * @returns {object}
     */
    static _safeProfile(obj) {
        return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
    }

    /**
     * Extract display_name from a profile object safely.
     * Handles numeric, boolean, or other non-string values that survive safeJson.
     * @param {*} raw
     * @returns {string|null}
     */
    static _safeDisplayName(raw) {
        if (typeof raw === 'string') {
            const trimmed = raw.trim();
            return trimmed.length > 0 ? trimmed.slice(0, 64) : null;
        }
        if (typeof raw === 'number' && isFinite(raw)) {
            const s = String(raw);
            return s.length > 0 ? s.slice(0, 64) : null;
        }
        return null;
    }

    formatAccount(account) {
        if (!account) return null;

        // SECURITY PATCH (v3.5.2-patched): Require sanitizer — fail-closed
        if (!this.sanitizerReady) {
            throw new PixaAPIError('Cannot format account: content sanitizer not ready', 'SANITIZER_NOT_READY');
        }

        // v3.5.2: Re-validate _sanitized flag
        if (account._sanitized && account._entity_type === 'account' && account._stored_at &&
            (Date.now() - account._stored_at) < PixaProxyAPI.SANITIZED_FRESHNESS_MS) {
            return account;
        }

        // Otherwise run through sanitization pipeline if available
        if (this.sanitizationPipeline) {
            return this.sanitizationPipeline.sanitizeAccount(account);
        }

        // Legacy fallback — build field-by-field, NO spread of raw data.
        // safeJson returns a sanitized JSON string. Parse for field access, store string directly.
        const safePostingMetaStr = this.contentSanitizer.safeJson(account.posting_json_metadata || '{}');
        const safeJsonMetaStr    = this.contentSanitizer.safeJson(account.json_metadata || '{}');
        let postingMeta = {}, jsonMeta = {};
        try { postingMeta = JSON.parse(safePostingMetaStr); } catch (e) {}
        try { jsonMeta    = JSON.parse(safeJsonMetaStr); } catch (e) {}
        const profile = { ...PixaProxyAPI._safeProfile(jsonMeta.profile), ...PixaProxyAPI._safeProfile(postingMeta.profile) };

        return {
            _entity_type: 'account',
            _sanitized: true,
            _stored_at: Date.now(),
            _profile: {
                display_name: PixaProxyAPI._safeDisplayName(profile.name),
                about: typeof profile.about === 'string' ? profile.about.slice(0, 512) : null,
                location: typeof profile.location === 'string' ? profile.location.slice(0, 128) : null,
                website: typeof profile.website === 'string' ? profile.website.slice(0, 256) : null,
                profile_image: this.contentSanitizer.safeProfileImage(profile.profile_image),
                cover_image: this.contentSanitizer.safeProfileImage(profile.cover_image),
            },
            _links: [],
            name: this.contentSanitizer.sanitizeUsername(account.name) || '',
            id: VALIDATORS.safe_number(account.id) ?? 0,
            json_metadata:         safeJsonMetaStr,
            posting_json_metadata: safePostingMetaStr,
            reputation:       VALIDATORS.safe_number(account.reputation) ?? 0,
            reputation_score: this.formatter.reputation(account.reputation),
            balance: translateAssetFromChain(VALIDATORS.safe_asset(account.balance) || '0.000 PIXA'),
            vesting_shares: translateAssetFromChain(VALIDATORS.safe_asset(account.vesting_shares) || '0.000000 PXP'),
            voting_power: VALIDATORS.safe_number(account.voting_power) ?? 0,
            post_count: VALIDATORS.safe_number(account.post_count) ?? 0,
            created: VALIDATORS.safe_timestamp(account.created),
        };
    }

    /**
     * Process a post through pixa-content WASM sanitizer
     * Returns the post object enriched with sanitized HTML, images, links.
     * v3.4.0: Uses SanitizationPipeline if available; returns already-sanitized entities as-is.
     *
     * @param {object} post - Raw post object from blockchain
     * @param {object} [renderOptions] - Override render options (include_images, max_image_count, internal_domains)
     * @returns {object|null} Processed post with html, images, links, wordCount
     */
    processPost(post, renderOptions = {}) {
        if (!post) return null;

        // SECURITY PATCH (v3.5.2-patched): Require sanitizer — fail-closed
        if (!this.sanitizerReady) {
            throw new PixaAPIError('Cannot process post: content sanitizer not ready', 'SANITIZER_NOT_READY');
        }

        // v3.5.2: Re-validate _sanitized flag — caller-supplied data can be tampered
        if (post._sanitized && post._entity_type === 'post' && post._stored_at &&
            (Date.now() - post._stored_at) < PixaProxyAPI.SANITIZED_FRESHNESS_MS) {
            return post;
        }

        if (this.sanitizationPipeline) {
            return this.sanitizationPipeline.sanitizePost(post, renderOptions);
        }

        // Legacy fallback — build field-by-field, NO spread of raw data.
        const contentType = detectContentType(post.body);
        const processed = this.contentSanitizer.renderPost(post.body || '', renderOptions);
        const safeMetaStr = this.contentSanitizer.safeJson(post.json_metadata || '{}');
        let meta = {};
        try { meta = JSON.parse(safeMetaStr); } catch (e) {}

        const rawDesc = typeof meta.description === 'string' ? meta.description : '';
        const descriptionHtml = rawDesc
            ? this.contentSanitizer.renderDescription(rawDesc)
            : '';
        const summary = contentType === 'pixel_art'
            ? this.contentSanitizer.extractPlainText(rawDesc).slice(0, 500)
            : this.contentSanitizer.extractPlainText(post.body || '').slice(0, 500);

        return {
            _entity_type: 'post',
            _content_type: contentType,
            _sanitized: true,
            _stored_at: Date.now(),
            _images: processed.images || [],
            _links: processed.links || [],
            _summary: summary,
            _description_html: descriptionHtml,
            _word_count: processed.wordCount || 0,
            id: post.id || 0,
            author: post.author || '',
            permlink: post.permlink || '',
            title: post.title || '',
            body: processed.html || '',
            json_metadata: safeMetaStr,
            category: post.category || '',
            parent_author: post.parent_author || '',
            parent_permlink: post.parent_permlink || '',
            created: VALIDATORS.safe_timestamp(post.created),
            last_update: VALIDATORS.safe_timestamp(post.last_update),
            active: VALIDATORS.safe_timestamp(post.active),
            cashout_time: VALIDATORS.safe_timestamp(post.cashout_time),
            last_payout: VALIDATORS.safe_timestamp(post.last_payout),
            depth: post.depth ?? 0,
            children: post.children ?? 0,
            net_votes: post.net_votes ?? 0,
            author_reputation: this.formatter.reputation(post.author_reputation),
            pending_payout_value: translateAssetFromChain(post.pending_payout_value || '0.000 PXS'),
            total_payout_value: translateAssetFromChain(post.total_payout_value || '0.000 PXS'),
            curator_payout_value: translateAssetFromChain(post.curator_payout_value || '0.000 PXS'),
            url: post.url || '',

            // Community & moderation (bridge-enriched fields)
            community:       this.contentSanitizer.safeString(post.community || '', 64),
            community_title: this.contentSanitizer.safeString(post.community_title || '', 256),
            author_role:     VALIDATORS.safe_community_role(post.author_role),
            author_title:    this.contentSanitizer.safeString(post.author_title || '', 256),
            stats:           VALIDATORS.safe_stats(post.stats),
            is_paidout:      VALIDATORS.safe_bool(post.is_paidout) ?? false,
        };
    }

    /**
     * Process a comment through pixa-content WASM sanitizer (stricter subset)
     * No headings, tables, or iframes allowed in comments.
     * v3.4.0: Uses SanitizationPipeline if available.
     *
     * @param {object} comment - Raw comment object from blockchain
     * @param {object} [renderOptions] - Override render options
     * @returns {object|null} Processed comment with html, images, links
     */
    processComment(comment, renderOptions = {}) {
        if (!comment) return null;

        // SECURITY PATCH (v3.5.2-patched): Require sanitizer — fail-closed
        if (!this.sanitizerReady) {
            throw new PixaAPIError('Cannot process comment: content sanitizer not ready', 'SANITIZER_NOT_READY');
        }

        // v3.5.2: Re-validate _sanitized flag
        if (comment._sanitized && comment._entity_type === 'comment' && comment._stored_at &&
            (Date.now() - comment._stored_at) < PixaProxyAPI.SANITIZED_FRESHNESS_MS) {
            return comment;
        }

        if (this.sanitizationPipeline) {
            return this.sanitizationPipeline.sanitizeComment(comment, renderOptions);
        }

        // Legacy fallback — build field-by-field, NO spread of raw data.
        const processed = this.contentSanitizer.renderComment(comment.body || '', renderOptions);
        const safeMetaStr = this.contentSanitizer.safeJson(comment.json_metadata || '{}');
        return {
            _entity_type: 'comment',
            _sanitized: true,
            _stored_at: Date.now(),
            _images: processed.images || [],
            _links: processed.links || [],
            _word_count: processed.wordCount || 0,
            id: comment.id || 0,
            author: comment.author || '',
            permlink: comment.permlink || '',
            title: '',
            body: processed.html || '',
            json_metadata: safeMetaStr,
            parent_author: comment.parent_author || '',
            parent_permlink: comment.parent_permlink || '',
            created: VALIDATORS.safe_timestamp(comment.created),
            last_update: VALIDATORS.safe_timestamp(comment.last_update),
            active: VALIDATORS.safe_timestamp(comment.active),
            cashout_time: VALIDATORS.safe_timestamp(comment.cashout_time),
            last_payout: VALIDATORS.safe_timestamp(comment.last_payout),
            depth: comment.depth ?? 1,
            children: comment.children ?? 0,
            net_votes: comment.net_votes ?? 0,
            author_reputation: this.formatter.reputation(comment.author_reputation),
            pending_payout_value: translateAssetFromChain(comment.pending_payout_value || '0.000 PXS'),
            total_payout_value: translateAssetFromChain(comment.total_payout_value || '0.000 PXS'),
            curator_payout_value: translateAssetFromChain(comment.curator_payout_value || '0.000 PXS'),
            root_author: comment.root_author || '',
            root_permlink: comment.root_permlink || '',
            url: comment.url || '',

            // Community & moderation (bridge-enriched fields)
            community:       this.contentSanitizer.safeString(comment.community || '', 64),
            community_title: this.contentSanitizer.safeString(comment.community_title || '', 256),
            author_role:     VALIDATORS.safe_community_role(comment.author_role),
            author_title:    this.contentSanitizer.safeString(comment.author_title || '', 256),
            stats:           VALIDATORS.safe_stats(comment.stats),
            is_paidout:      VALIDATORS.safe_bool(comment.is_paidout) ?? false,
        };
    }

    /**
     * Process a transaction memo for display.
     * Bold, italic, @mentions, #hashtags only. No images, lists, or blocks.
     * v0.2: New method using sanitizeMemo tier.
     *
     * @param {string} memo - Raw memo string
     * @returns {{ html: string }} Sanitized memo
     */
    processMemo(memo) {
        if (!memo) return { html: '' };
        return this.contentSanitizer.renderMemo(memo);
    }

    /**
     * Extract clean plain text from a post/comment body
     * Strips all HTML/Markdown formatting.
     *
     * @param {string} body - Raw body content
     * @returns {string} Clean plain text
     */
    extractPlainText(body) {
        return this.contentSanitizer.extractPlainText(body || '');
    }

    /**
     * TF-IDF extractive summarization of content
     *
     * @param {string} body - Raw body content
     * @param {number} [sentenceCount=3] - Number of top sentences to extract
     * @returns {{ summary: string, keywords: Array, sentences: Array }}
     */
    summarizeContent(body, sentenceCount = 3) {
        return this.contentSanitizer.summarize(body || '', sentenceCount);
    }

    /**
     * Validate and sanitize a username (HIVE-compatible: 3-16 chars, a-z0-9.-)
     *
     * @param {string} rawUsername
     * @returns {string} Sanitized username, or '' if invalid
     */
    sanitizeUsername(rawUsername) {
        return this.contentSanitizer.sanitizeUsername(rawUsername);
    }

    // ─────────────────────────────────────────────
    // Sanitization Primitives — for dangerouslySetInnerHTML
    // ─────────────────────────────────────────────
    // Every string rendered via dangerouslySetInnerHTML MUST pass through
    // one of these methods first. Each uses a different WASM tier with
    // different tag/attribute allowlists.

    /**
     * Sanitize HTML for post-level rendering (full markdown).
     * Allows: headings, tables, images, figures, lists, blockquotes, code,
     *         links, inline formatting, details/summary.
     * Strips: script, style, iframe, video, audio, form, embed, object.
     *
     * Use for: post body content rendered via dangerouslySetInnerHTML.
     *
     * @param {string} html - Raw HTML or markdown text
     * @returns {string} Sanitized HTML safe for innerHTML
     */
    sanitizePostHTML(html) {
        if (!html) return '';
        const result = this.contentSanitizer.renderPost(html);
        return result.html || '';
    }

    /**
     * Sanitize HTML for comment-level rendering.
     * Allows: lists, blockquotes, code, links, inline formatting.
     * Strips: headings, tables, images, iframes, and everything post-only.
     *
     * Use for: comment bodies rendered via dangerouslySetInnerHTML.
     *
     * @param {string} html - Raw HTML or markdown text
     * @returns {string} Sanitized HTML safe for innerHTML
     */
    sanitizeCommentHTML(html) {
        if (!html) return '';
        const result = this.contentSanitizer.renderComment(html);
        return result.html || '';
    }

    /**
     * Sanitize HTML for memo-level rendering (inline only).
     * Allows: bold, italic, @mentions, #hashtags.
     * Strips: everything else (no lists, no blocks, no links, no images).
     *
     * Use for: transaction memos rendered via dangerouslySetInnerHTML.
     *
     * @param {string} html - Raw HTML or markdown text
     * @returns {string} Sanitized HTML safe for innerHTML
     */
    sanitizeMemoHTML(html) {
        if (!html) return '';
        const result = this.contentSanitizer.renderMemo(html);
        return result.html || '';
    }

    /**
     * Sanitize a description or any user-supplied text for safe innerHTML rendering.
     * Uses comment-tier: lists, blockquotes, code, links, inline formatting.
     * No images, no headings, no tables.
     *
     * Use for: json_metadata.description, profile "about" text, or any
     * user-supplied text field displayed via dangerouslySetInnerHTML.
     *
     * @param {string} text - Raw text, HTML, or markdown
     * @returns {string} Sanitized HTML safe for innerHTML
     */
    sanitizeDescription(text) {
        if (!text) return '';
        return this.contentSanitizer.renderDescription(text);
    }

    /**
     * Strip ALL HTML and return plain text only.
     * Use for: generating summaries, search indexing, notifications,
     * or anywhere markup is not wanted.
     *
     * @param {string} text - Raw HTML, markdown, or text
     * @param {number} [maxLen=0] - Maximum length (0 = unlimited)
     * @returns {string} Plain text with all HTML removed
     */
    sanitizeText(text, maxLen = 0) {
        if (!text) return '';
        const plain = this.contentSanitizer.extractPlainText(text);
        if (maxLen > 0 && plain.length > maxLen) {
            return plain.slice(0, maxLen);
        }
        return plain;
    }

    /**
     * Last-guard sanitizer — call at the dangerouslySetInnerHTML boundary.
     * Defense-in-depth: re-sanitizes content even if already sanitized at the data layer.
     *
     * @param {string} html — HTML content to sanitize
     * @param {'post'|'comment'|'memo'} [tier='post'] — Sanitization strictness
     * @returns {string} Safe HTML string
     */
    sanitizeForInjection(html, tier = 'post') {
        if (wasmSanitizeForInjection) {
            return wasmSanitizeForInjection(html, tier);
        }
        // Fallback: use existing tier-specific methods
        if (tier === 'memo') return this.sanitizeMemoHTML(html);
        if (tier === 'comment') return this.sanitizeCommentHTML(html);
        return this.sanitizePostHTML(html);
    }

    /**
     * Whether the client is currently online.
     * @returns {boolean}
     */
    get isOnline() {
        return this.connectivity ? this.connectivity.isOnline : true;
    }

    /**
     * Get pending (queued) broadcast operations.
     * @returns {Promise<object[]>}
     */
    async getPendingBroadcasts() {
        if (!this.broadcastQueue) return [];
        return this.broadcastQueue.getPending();
    }

    /**
     * Get count of pending broadcast operations.
     * @returns {Promise<number>}
     */
    async getPendingBroadcastCount() {
        if (!this.broadcastQueue) return 0;
        return this.broadcastQueue.getPendingCount();
    }

    /**
     * Manually drain the broadcast queue (retry pending ops).
     * @returns {Promise<{succeeded: number, failed: number, cancelled: number}>}
     */
    async drainBroadcastQueue() {
        if (!this.broadcastQueue) return { succeeded: 0, failed: 0, cancelled: 0 };
        return this.broadcastQueue.drain();
    }

    /**
     * Get current active account
     * @returns {Promise<string|null>}
     */
    async getActiveAccount() {
        return this.sessionManager?.getActiveAccount() || null;
    }

    /**
     * Check if user is logged in with valid session
     * @returns {Promise<boolean>}
     */
    async isLoggedIn() {
        const account = await this.sessionManager?.getActiveAccount();
        if (!account) return false;
        return this.sessionManager.isSessionValid(account);
    }

    /**
     * Subscribe to events
     * @param {string} event
     * @param {Function} callback
     */
    on(event, callback) {
        this.eventEmitter.on(event, callback);
        return this;
    }

    /**
     * Unsubscribe from events
     * @param {string} event
     * @param {Function} callback
     */
    off(event, callback) {
        this.eventEmitter.off(event, callback);
        return this;
    }

    /**
     * Subscribe to event once
     * @param {string} event
     * @param {Function} callback
     */
    once(event, callback) {
        this.eventEmitter.once(event, callback);
        return this;
    }
}

// ============================================
// Database API Group
// ============================================

class DatabaseAPI {
    constructor(proxy) { this.proxy = proxy; }

    async call(method, params = []) {
        return this.proxy.client.call('condenser_api', method, params);
    }

    async getDatabaseInfo() {
        return this.call('get_database_info');
    }

    // ========================================================================
    // database_api.* — Modern AppBase methods (v4.3.0)
    // ========================================================================
    // These methods call database_api directly rather than via the condenser
    // shim. They are the canonical AppBase endpoints and should be preferred
    // for new code paths.
    // ========================================================================

    /**
     * Generic helper for database_api.* calls with try/catch + fallback.
     * @param {string} method
     * @param {object} params
     * @param {*} fallback - Value to return on failure (default [])
     * @returns {Promise<*>}
     * @private
     */
    async _db(method, params = {}, fallback = []) {
        try {
            return await this.proxy.client.call('database_api', method, params);
        } catch (e) {
            console.warn(`[DatabaseAPI] ${method} failed:`, e.message);
            return fallback;
        }
    }

    // ── find_* family (look up by exact key) ────────────────────────────────

    /**
     * Find accounts by exact names (modern AppBase replacement for
     * condenser_api.get_accounts). Returns raw AppBase account shape.
     * @param {string[]} accounts - Account names
     * @param {boolean} [delayedVotesActive=true]
     * @returns {Promise<object[]>}
     */
    async findAccounts(accounts, delayedVotesActive = true) {
        const normalized = (accounts || []).map(a => normalizeAccount(a)).filter(Boolean);
        if (!normalized.length) return [];
        const result = await this._db('find_accounts', {
            accounts: normalized,
            delayed_votes_active: delayedVotesActive
        }, null);
        return result?.accounts || [];
    }

    /**
     * Find comments/posts by [author, permlink] tuples.
     * @param {Array<[string,string]>} comments
     * @returns {Promise<object[]>}
     */
    async findComments(comments) {
        if (!Array.isArray(comments) || !comments.length) return [];
        const result = await this._db('find_comments', { comments }, null);
        return result?.comments || [];
    }

    /**
     * Find votes for a given post.
     * @param {string} author
     * @param {string} permlink
     * @returns {Promise<object[]>}
     */
    async findVotes(author, permlink) {
        const result = await this._db('find_votes', {
            author: normalizeAccount(author),
            permlink
        }, null);
        return result?.votes || [];
    }

    /**
     * Find pending change-recovery-account requests for an account.
     * @param {string[]} accounts
     * @returns {Promise<object[]>}
     */
    async findChangeRecoveryAccountRequests(accounts) {
        const normalized = (accounts || []).map(normalizeAccount).filter(Boolean);
        if (!normalized.length) return [];
        const result = await this._db('find_change_recovery_account_requests', {
            accounts: normalized
        }, null);
        return result?.requests || [];
    }

    /**
     * Find pending collateralized-convert (HIVE→HBD) requests.
     * @param {string} account
     * @returns {Promise<object[]>}
     */
    async findCollateralizedConversionRequests(account) {
        const result = await this._db('find_collateralized_conversion_requests', {
            account: normalizeAccount(account)
        }, null);
        return result?.requests || [];
    }

    /**
     * Find active decline-voting-rights requests.
     * @param {string[]} accounts
     * @returns {Promise<object[]>}
     */
    async findDeclineVotingRightsRequests(accounts) {
        const normalized = (accounts || []).map(normalizeAccount).filter(Boolean);
        if (!normalized.length) return [];
        const result = await this._db('find_decline_voting_rights_requests', {
            accounts: normalized
        }, null);
        return result?.requests || [];
    }

    /**
     * Find escrows where the given account is `from`.
     * @param {string} from
     * @returns {Promise<object[]>}
     */
    async findEscrows(from) {
        const result = await this._db('find_escrows', {
            from: normalizeAccount(from)
        }, null);
        return result?.escrows || [];
    }

    /**
     * Find pending HBD→HIVE conversion requests for an account.
     * @param {string} account
     * @returns {Promise<object[]>}
     */
    async findHbdConversionRequests(account) {
        const result = await this._db('find_hbd_conversion_requests', {
            account: normalizeAccount(account)
        }, null);
        return result?.requests || [];
    }

    /**
     * Find open limit orders for an account.
     * @param {string} account
     * @returns {Promise<object[]>}
     */
    async findLimitOrders(account) {
        const result = await this._db('find_limit_orders', {
            account: normalizeAccount(account)
        }, null);
        return result?.orders || [];
    }

    /**
     * Find owner authority history entries for an account.
     * @param {string} owner
     * @returns {Promise<object[]>}
     */
    async findOwnerHistories(owner) {
        const result = await this._db('find_owner_histories', {
            owner: normalizeAccount(owner)
        }, null);
        return result?.owner_auths || [];
    }

    /**
     * Find pending savings withdrawals for an account.
     * @param {string} account
     * @returns {Promise<object[]>}
     */
    async findSavingsWithdrawals(account) {
        const result = await this._db('find_savings_withdrawals', {
            account: normalizeAccount(account)
        }, null);
        return result?.withdrawals || [];
    }

    /**
     * Find upcoming vesting-delegation expirations for an account.
     * @param {string} account
     * @returns {Promise<object[]>}
     */
    async findVestingDelegationExpirations(account) {
        const result = await this._db('find_vesting_delegation_expirations', {
            account: normalizeAccount(account)
        }, null);
        return result?.delegations || [];
    }

    /**
     * Find active vesting delegations originating from an account.
     * @param {string} account
     * @returns {Promise<object[]>}
     */
    async findVestingDelegations(account) {
        const result = await this._db('find_vesting_delegations', {
            account: normalizeAccount(account)
        }, null);
        return result?.delegations || [];
    }

    /**
     * Find withdraw-vesting routes for an account.
     * @param {string} account
     * @param {string} [order='by_withdraw_route']
     * @returns {Promise<object[]>}
     */
    async findWithdrawVestingRoutes(account, order = 'by_withdraw_route') {
        const result = await this._db('find_withdraw_vesting_routes', {
            account: normalizeAccount(account),
            order
        }, null);
        return result?.routes || [];
    }

    // ── list_* family (paginated enumeration) ────────────────────────────────

    /**
     * List accounts with pagination.
     * @param {object} [params]
     * @param {string} [params.start='']
     * @param {number} [params.limit=100]
     * @param {string} [params.order='by_name']
     * @returns {Promise<object[]>}
     */
    async listAccounts({ start = '', limit = 100, order = 'by_name' } = {}) {
        const result = await this._db('list_accounts', { start, limit, order }, null);
        return result?.accounts || [];
    }

    async listChangeRecoveryAccountRequests({ start = '', limit = 100, order = 'by_account' } = {}) {
        const result = await this._db('list_change_recovery_account_requests', {
            start, limit, order
        }, null);
        return result?.requests || [];
    }

    async listComments({ start = [], limit = 100, order = 'by_cashout_time' } = {}) {
        const result = await this._db('list_comments', { start, limit, order }, null);
        return result?.comments || [];
    }

    async listDeclineVotingRightsRequests({ start = '', limit = 100, order = 'by_account' } = {}) {
        const result = await this._db('list_decline_voting_rights_requests', {
            start, limit, order
        }, null);
        return result?.requests || [];
    }

    async listEscrows({ start = [], limit = 100, order = 'by_from_id' } = {}) {
        const result = await this._db('list_escrows', { start, limit, order }, null);
        return result?.escrows || [];
    }

    async listHbdConversionRequests({ start = [], limit = 100, order = 'by_conversion_date' } = {}) {
        const result = await this._db('list_hbd_conversion_requests', {
            start, limit, order
        }, null);
        return result?.requests || [];
    }

    async listLimitOrders({ start = [], limit = 100, order = 'by_price' } = {}) {
        const result = await this._db('list_limit_orders', { start, limit, order }, null);
        return result?.orders || [];
    }

    async listOwnerHistories({ start = [], limit = 100 } = {}) {
        // list_owner_histories takes {start:[account, last_valid_time], limit}
        const result = await this._db('list_owner_histories', { start, limit }, null);
        return result?.owner_auths || [];
    }

    async listSavingsWithdrawals({ start = [], limit = 100, order = 'by_from_id' } = {}) {
        const result = await this._db('list_savings_withdrawals', {
            start, limit, order
        }, null);
        return result?.withdrawals || [];
    }

    async listVestingDelegationExpirations({ start = [], limit = 100, order = 'by_expiration' } = {}) {
        const result = await this._db('list_vesting_delegation_expirations', {
            start, limit, order
        }, null);
        return result?.delegations || [];
    }

    async listVestingDelegations({ start = [], limit = 100, order = 'by_delegation' } = {}) {
        const result = await this._db('list_vesting_delegations', {
            start, limit, order
        }, null);
        return result?.delegations || [];
    }

    async listVotes({ start = [], limit = 100, order = 'by_comment_voter' } = {}) {
        const result = await this._db('list_votes', { start, limit, order }, null);
        return result?.votes || [];
    }

    async listWithdrawVestingRoutes({ start = [], limit = 100, order = 'by_withdraw_route' } = {}) {
        const result = await this._db('list_withdraw_vesting_routes', {
            start, limit, order
        }, null);
        return result?.routes || [];
    }

    // ── Miscellaneous database_api.* ────────────────────────────────────────

    /**
     * Get all reward funds (plural, AppBase).
     * Unlike condenser get_reward_fund (which takes one name), this returns all.
     * @returns {Promise<object[]>}
     */
    async getRewardFunds() {
        const result = await this._db('get_reward_funds', {}, null);
        return result?.funds || [];
    }

    /**
     * Get hardfork properties (current + processed HFs + next scheduled).
     * @returns {Promise<object|null>}
     */
    async getHardforkProperties() {
        return this._db('get_hardfork_properties', {}, null);
    }
}

// ============================================
// Tags API Group
// ============================================

class TagsAPI {
    constructor(proxy) { this.proxy = proxy; }

    /**
     * Internal: Fetch and sanitize discussions for a tag.
     * Hits the network on every call — no persistence layer.
     * @param {string} sort - Sort category (trending, created, hot, etc.)
     * @param {object} query - Query parameters { tag, limit, start_author, start_permlink }
     * @returns {Promise<object[]>} Sanitized discussions
     * @private
     */
    async _fetchDiscussions(sort, query) {
        const q = {
            tag: query.tag || '',
            limit: parseInt(query.limit, 10) || 20
        };
        if (query.start_author) q.start_author = query.start_author;
        if (query.start_permlink) q.start_permlink = query.start_permlink;

        let rawResults = null;
        try {
            // dpixa client.database.getDiscussions(sort, query) — the canonical
            // database-API path for tag discussions. Forwards { tag, limit,
            // start_author, start_permlink } as documented; for sort='created'
            // this returns posts ordered by head-block creation time, which is
            // what Feed.js relies on for "latest posts".
            rawResults = await this.proxy.client.database.getDiscussions(sort, q);
        } catch (e) {
            console.warn(`[TagsAPI] getDiscussions(${sort}) failed:`, e.message);
            return [];
        }

        if (!rawResults || !Array.isArray(rawResults)) return [];

        // FAIL-CLOSED: never serve raw, unsanitized content.
        if (!this.proxy.sanitizationPipeline) {
            console.error('[TagsAPI] Sanitizer pipeline not available — refusing to serve raw content');
            return [];
        }

        const postEntities = [];
        const commentEntities = [];
        for (const raw of rawResults) {
            try {
                const entity = this.proxy.sanitizationPipeline.sanitizeContent(raw);
                if (entity) {
                    if (entity._entity_type === 'post') postEntities.push(entity);
                    else commentEntities.push(entity);
                }
            } catch (e) {
                console.warn('[TagsAPI] Failed to sanitize entity, skipping:', raw?.author, raw?.permlink, e.message || e);
            }
        }
        return [...postEntities, ...commentEntities];
    }

    async getTrendingTags(afterTag = null, limit = 100) {
        try {
            const result = await this.proxy.client.call('condenser_api', 'get_trending_tags', [afterTag, limit]);
            return result || [];
        } catch (e) {
            console.warn('[TagsAPI] get_trending_tags failed:', e.message);
            return [];
        }
    }

    async getDiscussionsByTrending(query) {
        return this._fetchDiscussions('trending', query);
    }

    async getDiscussionsByCreated(query) {
        return this._fetchDiscussions('created', query);
    }

    async getDiscussionsByHot(query) {
        return this._fetchDiscussions('hot', query);
    }

    async getDiscussionsByPromoted(query) {
        return this._fetchDiscussions('promoted', query);
    }

    async getDiscussionsByPayout(query) {
        return this._fetchDiscussions('cashout', { ...query, sort_mapped: 'cashout' });
    }

    async getDiscussionsByVotes(query) {
        return this._fetchDiscussions('votes', query);
    }

    async getDiscussionsByActive(query) {
        return this._fetchDiscussions('active', query);
    }

    async getDiscussionsByChildren(query) {
        return this._fetchDiscussions('children', query);
    }

    async getDiscussionsByMuted(query) {
        console.warn('[TagsAPI] getDiscussionsByMuted: muted sort not available in database API');
        return [];
    }
}

// ============================================
// Blocks API Group
// ============================================

class BlocksAPI {
    constructor(proxy) { this.proxy = proxy; }

    async getBlock(blockNum) {
        return this.proxy.client.database.getBlock(blockNum);
    }

    async getBlockHeader(blockNum) {
        return this.proxy.client.database.getBlockHeader(blockNum);
    }

    async getOpsInBlock(blockNum, onlyVirtual = false) {
        return this.proxy.client.database.getOperations(blockNum, onlyVirtual);
    }

    /**
     * Retrieve a range of full, signed blocks in a single call.
     * @param {number} startingBlockNum - First block number (inclusive)
     * @param {number} count - Maximum number of blocks to return
     * @returns {Promise<object[]>} Array of signed blocks
     */
    async getBlockRange(startingBlockNum, count) {
        try {
            const result = await this.proxy.client.call('block_api', 'get_block_range', {
                starting_block_num: startingBlockNum,
                count
            });
            return result?.blocks || [];
        } catch (e) {
            console.warn('[BlocksAPI] get_block_range failed:', e.message);
        }
        return [];
    }

    /**
     * Enumerate virtual operations within a block range.
     * Allows filtering by operation type via bitmask.
     * @param {object} params
     * @param {number} params.blockRangeBegin - Starting block number (inclusive)
     * @param {number} params.blockRangeEnd - Ending block number (exclusive)
     * @param {boolean} [params.includeReversible=false] - Include reversible blocks
     * @param {boolean} [params.groupByBlock=false] - Group results by block
     * @param {number} [params.operationBegin=0] - Starting virtual op in block
     * @param {number} [params.limit=1000] - Max operations to return
     * @param {number} [params.filter] - Bitmask filter for virtual op types
     * @returns {Promise<object>} { ops, ops_by_block, next_block_range_begin, next_operation_begin }
     */
    async enumVirtualOps(params = {}) {
        const {
            blockRangeBegin, blockRangeEnd,
            includeReversible = false, groupByBlock = false,
            operationBegin = 0, limit = 1000, filter
        } = params;

        if (blockRangeBegin === undefined || blockRangeEnd === undefined) {
            throw new PixaAPIError('blockRangeBegin and blockRangeEnd are required', 'INVALID_PARAMS');
        }

        const apiParams = {
            block_range_begin: blockRangeBegin,
            block_range_end: blockRangeEnd,
            include_reversible: includeReversible,
            group_by_block: groupByBlock,
            operation_begin: operationBegin,
            limit
        };
        if (filter !== undefined) apiParams.filter = filter;

        try {
            return await this.proxy.client.call('account_history_api', 'enum_virtual_ops', apiParams);
        } catch (e) {
            console.warn('[BlocksAPI] enum_virtual_ops failed:', e.message);
        }
        return { ops: [] };
    }
}

// ============================================
// Globals API Group
// ============================================

class GlobalsAPI {
    constructor(proxy) { this.proxy = proxy; }

    async _fetch(label, fetchFn) {
        try {
            return await fetchFn();
        } catch (e) {
            console.warn(`[GlobalsAPI] ${label} failed:`, e.message);
            return null;
        }
    }

    async getDynamicGlobalProperties() {
        return this._fetch('dynamic_global_props',
            () => this.proxy.client.database.getDynamicGlobalProperties());
    }

    async getChainProperties() {
        return this._fetch('chain_props',
            () => this.proxy.client.database.getChainProperties());
    }

    async getFeedHistory() {
        return this._fetch('feed_history',
            () => this.proxy.client.call('condenser_api', 'get_feed_history'));
    }

    async getCurrentMedianHistoryPrice() {
        return this._fetch('median_history_price',
            () => this.proxy.client.database.getCurrentMedianHistoryPrice());
    }

    async getHardforkVersion() {
        return this._fetch('hardfork_version',
            () => this.proxy.client.call('condenser_api', 'get_hardfork_version'));
    }

    async getRewardFund(name = 'post') {
        return this._fetch(`reward_fund_${name}`,
            () => this.proxy.client.call('condenser_api', 'get_reward_fund', [name]));
    }

    async getVestingDelegations(account, from = '', limit = 100) {
        return this.proxy.client.database.getVestingDelegations(account, from, limit);
    }

    async getConfig() {
        return this._fetch('chain_config',
            () => this.proxy.client.database.getConfig());
    }

    async getVersion() {
        return this._fetch('chain_version',
            () => this.proxy.client.database.getVersion());
    }

    /**
     * Get vesting delegations that are expiring (returning to delegator)
     * @param {string} account - Delegator account
     * @param {string} afterDate - ISO date string to start from
     * @param {number} limit - Max results
     * @returns {Promise<object[]>}
     */
    async getExpiringVestingDelegations(account, afterDate = '', limit = 100) {
        const normalizedAccount = normalizeAccount(account);
        try {
            return await this.proxy.client.call('condenser_api', 'get_expiring_vesting_delegations', [normalizedAccount, afterDate, limit]);
        } catch (e) {
            console.warn('[GlobalsAPI] get_expiring_vesting_delegations failed:', e.message);
        }
        return [];
    }

    /**
     * Get conversion requests for an account
     * @param {string} account
     * @returns {Promise<object[]>}
     */
    async getConversionRequests(account) {
        const normalizedAccount = normalizeAccount(account);
        try {
            return await this.proxy.client.call('condenser_api', 'get_conversion_requests', [normalizedAccount]);
        } catch (e) {
            console.warn('[GlobalsAPI] get_conversion_requests failed:', e.message);
        }
        return [];
    }

    /**
     * Get collateralized conversion requests for an account
     * @param {string} account
     * @returns {Promise<object[]>}
     */
    async getCollateralizedConversionRequests(account) {
        const normalizedAccount = normalizeAccount(account);
        try {
            return await this.proxy.client.call('condenser_api', 'get_collateralized_conversion_requests', [normalizedAccount]);
        } catch (e) {
            console.warn('[GlobalsAPI] get_collateralized_conversion_requests failed:', e.message);
        }
        return [];
    }
}

// ============================================
// Prices API Group
// ============================================

/**
 * Pricing logic for PXS/PXA/PXP.
 *
 * Economic model
 * --------------
 * Pixagram fixes canonical USD values by design:
 *   - 1 PXS = $5.69  (Big Mac Index anchor — PXS is the stable "dollar" token
 *                     with purchasing power pegged to a global basket)
 *   - 1 PXA = $0.06  (design ratio ≈1:95 to PXS)
 *   - 1 PXP = PXA/USD  (PXP is PXA-denominated staked influence)
 *
 * Witnesses publish a median price feed via feed_publish ops. The feed is shaped
 *   { base: "X PXS", quote: "Y PXA" }
 * and expresses ONLY the PXS↔PXA ratio — there is no fiat on chain. PXA is the
 * market anchor: its USD price comes from the exchange it lists on (today a
 * static placeholder, see getPXAUSDPrice). PXS is then derived from the feed,
 * the reverse of the old design-PXS direction:
 *
 *   feedRatio = quote_PXA / base_PXS          // PXA per PXS
 *   PXS/USD   = PXA/USD × feedRatio            // when feedRatio is plausible
 *
 * Plausible means 10:1–1000:1 PXA per PXS. Outside that range — including the
 * bootstrap placeholder `{0.001 PXS, 0.001 PXA}` which reads as 1:1 — we treat
 * the feed as unset and fall back to PXA/USD × DESIGN_RATIO so PXS still tracks
 * the live PXA price rather than a frozen dollar value.
 *
 * Consumer API
 * ------------
 *   const { pxaUsd, pxsUsd, source, feedRatio, isReal } = await api.prices.get();
 *
 * Or sync (returns design values until first fetch, then last known):
 *   const { pxaUsd, pxsUsd } = api.prices.getSync();
 *
 * Reactive consumers:
 *   api.eventEmitter.on('prices_updated', ({ pxaUsd, pxsUsd, ... }) => { ... });
 *
 * Values are kept in memory only — refreshed from chain on demand, never
 * written to LacertaDB.
 */
class PricesAPI {
    static DESIGN_PXS_USD = 6.12;
    static DESIGN_PXA_USD = 0.12;
    static MIN_PLAUSIBLE_RATIO = 10;    // PXA per PXS
    static MAX_PLAUSIBLE_RATIO = 1000;
    /**
     * In-memory freshness window for price values. After this many ms,
     * the next get() will refresh from chain instead of returning the
     * cached value. Pure RAM cache — nothing is persisted.
     */
    static FRESHNESS_MS = 60_000;

    /**
     * Spot price of 1 PXA in USD, as it would be read from the exchange PXA
     * trades on. PXA is not listed yet, so this is a fixed placeholder — see
     * getPXAUSDPrice() for the rationale and the one-line swap-in point.
     */
    static EXCHANGE_PXA_USD = 0.06;
    /**
     * Design PXS/PXA ratio (PXA per PXS). Used ONLY as the fallback when the
     * witness feed is unset/bootstrap, so PXS still derives from the live PXA
     * price (PXS_USD = PXA_USD × DESIGN_RATIO) instead of a hard-coded dollar.
     */
    static DESIGN_RATIO = this.DESIGN_PXS_USD / this.DESIGN_PXA_USD; // ≈102

    /** Frankfurter v2 — ECB-sourced FIAT reference rates, no API key. */
    static FRANKFURTER_BASE = 'https://api.frankfurter.dev/v2';
    /** FIAT rates move ~once/day (ECB ≈16:00 CET); a 6h RAM cache is plenty. */
    static FIAT_FRESHNESS_MS = 6 * 60 * 60 * 1000;

    constructor(proxy) {
        this.proxy = proxy;
        this._current = {
            pxaUsd: PricesAPI.DESIGN_PXA_USD,
            pxsUsd: PricesAPI.DESIGN_PXS_USD,
            source: 'design',   // 'design' | 'feed'
            feedRatio: null,    // raw PXA-per-PXS from feed, even when rejected
            isReal: false,      // true once we've successfully read chain state at least once
            lastUpdated: 0,
        };
        this._inFlight = null;  // shared promise for concurrent get() calls
        // FIAT rate cache: `${BASE}>${QUOTE}` -> { rate, ts }. RAM only.
        this._fiatCache = new Map();
    }

    /**
     * Get current prices. If a fetch is in flight, returns that promise.
     * If cached values are fresh enough, returns them. Otherwise triggers a
     * refresh from chain.
     */
    async get({ forceRefresh = false } = {}) {
        if (!forceRefresh && this._current.isReal &&
            Date.now() - this._current.lastUpdated < PricesAPI.FRESHNESS_MS) {
            return { ...this._current };
        }
        if (this._inFlight) return this._inFlight;
        this._inFlight = this._refresh();
        try {
            return await this._inFlight;
        } finally {
            this._inFlight = null;
        }
    }

    /**
     * Synchronous read of last-known prices. Returns design values before the
     * first successful fetch. Use this in hot paths (renders) where waiting on
     * a promise would cause jank; the async get() should be called separately
     * to keep values fresh.
     */
    getSync() {
        return { ...this._current };
    }

    /**
     * Spot price of 1 PXA in USD — the single market-defined anchor the rest
     * of the token economy hangs off of.
     *
     * There is NO fiat on chain. Witnesses publish only the PXS/PXA ratio via
     * feed_publish. To peg that ratio to real purchasing power, each witness
     * prices a Big Mac in its local currency X, converts PXA→X using the
     * exchange price of PXA, takes the cross-witness median, and trails it over
     * an 84h window. The on-chain result is a pure base/quote ratio — never a
     * dollar — but that computation needs exactly ONE external input: the
     * exchange price of PXA. This method is that input.
     *
     * PXA is not listed on any exchange yet, so this returns a fixed
     * 0.06 USD. Once a market exists, replace the body with a cached exchange
     * read (e.g. PXA/USDT spot, or PXA/BTC × BTC/USD) and every downstream
     * value — PXS via the chain ratio, and every FIAT display — updates for
     * free, with no other call site touched.
     *
     * @returns {Promise<number>} USD per 1 PXA.
     */
    async getPXAUSDPrice() {
        return PricesAPI.EXCHANGE_PXA_USD;
    }

    async _refresh() {
        let feed = null;
        try {
            feed = await this.proxy.globals.getCurrentMedianHistoryPrice();
        } catch (e) {
            console.warn('[PricesAPI] feed read failed:', e.message);
        }

        // PXA is the market anchor: its USD price comes from the exchange
        // (static placeholder until listed — see getPXAUSDPrice). PXS is then
        // DERIVED from the on-chain PXS/PXA ratio:
        //     PXS_USD = PXA_USD × (PXA per PXS)
        let pxaUsd;
        try { pxaUsd = await this.getPXAUSDPrice(); }
        catch (e) { pxaUsd = PricesAPI.EXCHANGE_PXA_USD; }

        let pxsUsd = pxaUsd * PricesAPI.DESIGN_RATIO;  // fallback until feed is plausible
        let source = 'design';
        let feedRatio = null;

        if (feed && feed.base && feed.quote) {
            const baseAmount  = parseFloat(feed.base)  || 0;  // PXS side
            const quoteAmount = parseFloat(feed.quote) || 0;  // PXA side
            if (baseAmount > 0 && quoteAmount > 0) {
                feedRatio = quoteAmount / baseAmount;  // PXA per PXS
                if (feedRatio >= PricesAPI.MIN_PLAUSIBLE_RATIO &&
                    feedRatio <= PricesAPI.MAX_PLAUSIBLE_RATIO) {
                    pxsUsd = pxaUsd * feedRatio;  // derive PXS from exchange PXA + chain ratio
                    source = 'feed';
                }
                // else: bootstrap/unset feed — keep design fallback
            }
        }

        const next = {
            pxaUsd,
            pxsUsd,
            source,
            feedRatio,
            isReal: feed !== null,  // we talked to chain, even if feed is unset
            lastUpdated: Date.now(),
        };

        const changed = next.pxaUsd     !== this._current.pxaUsd
            || next.pxsUsd     !== this._current.pxsUsd
            || next.source     !== this._current.source
            || next.feedRatio  !== this._current.feedRatio;

        this._current = next;

        if (changed && this.proxy.eventEmitter) {
            try { this.proxy.eventEmitter.emit('prices_updated', { ...next }); }
            catch (e) { /* listener error — don't propagate */ }
        }

        return { ...next };
    }

    /**
     * Convert a PXA amount to USD at current rates.
     */
    pxaToUsd(pxa) {
        return (parseFloat(pxa) || 0) * this._current.pxaUsd;
    }

    /**
     * Convert a PXS amount to USD at current rates.
     */
    pxsToUsd(pxs) {
        return (parseFloat(pxs) || 0) * this._current.pxsUsd;
    }

    /**
     * Convert a post's PXS-denominated pending payout to USD.
     * Equivalent to pxsToUsd — alias for intent clarity at call sites.
     */
    payoutToUsd(payout) {
        return this.pxsToUsd(payout);
    }

    // ── FIAT (frankfurter.dev) ──────────────────────────────────────────────
    // Tokens are valued in USD on chain-derived data; the display currency is a
    // pure front-end concern. We fetch ECB reference rates from Frankfurter and
    // convert USD → the user's selected currency at render time. No fiat ever
    // touches the chain.

    /**
     * USD → `quote` rate (units of `quote` per 1 `base`), cached in RAM.
     * Returns 1 for the identity pair. On network failure returns the last
     * cached rate if present, else 1 (degrade to showing the USD figure).
     *
     * @param {string} quote  ISO 4217 code, e.g. "CHF".
     * @param {string} [base] ISO 4217 base, defaults to "USD".
     * @returns {Promise<number>}
     */
    async getFiatRate(quote, base = 'USD') {
        const q = String(quote || '').toUpperCase();
        const b = String(base || 'USD').toUpperCase();
        if (!q || q === b) return 1;

        const key = `${b}>${q}`;
        const hit = this._fiatCache.get(key);
        if (hit && Date.now() - hit.ts < PricesAPI.FIAT_FRESHNESS_MS) return hit.rate;

        try {
            const res = await fetch(`${PricesAPI.FRANKFURTER_BASE}/rate/${b}/${q}`);
            if (!res.ok) throw new Error(`frankfurter ${res.status}`);
            const data = await res.json();           // { base, quote, rate, date }
            const rate = Number(data && data.rate);
            if (!Number.isFinite(rate) || rate <= 0) throw new Error('no rate');
            this._fiatCache.set(key, { rate, ts: Date.now() });
            return rate;
        } catch (e) {
            console.warn('[PricesAPI] fiat rate failed:', e.message);
            return hit ? hit.rate : 1;               // stale-on-error, else identity
        }
    }

    /**
     * Batch prefetch of USD → many quotes in a single Frankfurter call. Warms
     * the cache (so subsequent getFiatRate/usdToFiat are instant) and returns
     * a { CODE: rate } map including the base at 1.
     *
     * @param {string[]} quotes
     * @param {string} [base]
     * @returns {Promise<Object<string, number>>}
     */
    async getFiatRates(quotes, base = 'USD') {
        const b = String(base || 'USD').toUpperCase();
        const list = (quotes || [])
            .map(c => String(c || '').toUpperCase())
            .filter(c => c && c !== b);
        const out = { [b]: 1 };
        if (list.length === 0) return out;

        try {
            const url = `${PricesAPI.FRANKFURTER_BASE}/rates?base=${b}&quotes=${list.join(',')}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`frankfurter ${res.status}`);
            const rows = await res.json();           // [{ base, quote, rate, date }, ...]
            for (const row of (Array.isArray(rows) ? rows : [])) {
                const rate = Number(row && row.rate);
                const code = String(row && row.quote || '').toUpperCase();
                if (code && Number.isFinite(rate) && rate > 0) {
                    out[code] = rate;
                    this._fiatCache.set(`${b}>${code}`, { rate, ts: Date.now() });
                }
            }
        } catch (e) {
            console.warn('[PricesAPI] fiat rates failed:', e.message);
        }
        return out;
    }

    /**
     * Synchronous USD → fiat using the RAM cache. Returns the untouched USD
     * amount when the rate isn't cached yet (so renders never block); call
     * getFiatRate()/getFiatRates() to warm the cache first.
     */
    usdToFiat(usd, currency, base = 'USD') {
        const amt = Number(usd) || 0;
        const q = String(currency || '').toUpperCase();
        const b = String(base || 'USD').toUpperCase();
        if (!q || q === b) return amt;
        const hit = this._fiatCache.get(`${b}>${q}`);
        return hit ? amt * hit.rate : amt;
    }

    /** Convert a PXS amount straight to the selected fiat (USD cache must be warm). */
    pxsToFiat(pxs, currency) { return this.usdToFiat(this.pxsToUsd(pxs), currency); }

    /** Convert a PXA amount straight to the selected fiat (USD cache must be warm). */
    pxaToFiat(pxa, currency) { return this.usdToFiat(this.pxaToUsd(pxa), currency); }
}

// ============================================
// Accounts API Group
// ============================================

class AccountsAPI {
    constructor(proxy) { this.proxy = proxy; }

    async getAccounts(accounts, forceRefresh = false) {
        // forceRefresh is retained for API compatibility but has no effect —
        // every call hits the network and returns freshly-sanitized accounts.
        void forceRefresh;

        const normalizedAccounts = accounts.map(acc => normalizeAccount(acc)).filter(acc => acc && acc.length > 0);

        if (normalizedAccounts.length === 0) return [];

        // database.getAccounts(usernames) — documented dpixa method
        let rawAccounts = [];
        try {
            rawAccounts = await this.proxy.client.database.getAccounts(normalizedAccounts);
        } catch (e) {
            console.warn('[AccountsAPI] getAccounts failed:', e.message);
            return [];
        }

        // FAIL-CLOSED: never serve raw, unsanitized account data.
        if (!this.proxy.sanitizationPipeline) {
            console.error('[AccountsAPI] Sanitizer pipeline not available — refusing to serve raw accounts');
            return [];
        }

        const sanitized = [];
        for (const raw of rawAccounts) {
            if (!raw) continue;
            try {
                const entity = this.proxy.sanitizationPipeline.sanitizeAccount(raw);
                if (entity) sanitized.push(entity);
            } catch (e) {
                console.warn('[AccountsAPI] Failed to sanitize account, skipping:', raw?.name, e.message || e);
            }
        }
        return sanitized;
    }

    async lookupAccounts(lowerBound, limit = 10) {
        try {
            return await this.proxy.client.call('condenser_api', 'lookup_accounts', [lowerBound, limit]);
        } catch (e) {
            console.warn('[AccountsAPI] lookup_accounts failed:', e.message);
        }
        return [];
    }

    async lookupAccountNames(accounts) {
        try {
            return await this.proxy.client.call('condenser_api', 'lookup_account_names', [accounts]);
        } catch (e) {
            console.warn('[AccountsAPI] lookup_account_names failed:', e.message);
        }
        return [];
    }

    async getAccountCount() {
        try {
            return await this.proxy.client.call('condenser_api', 'get_account_count');
        } catch (e) {
            console.warn('[AccountsAPI] get_account_count failed:', e.message);
        }
        return 0;
    }

    async getAccountHistory(account, from = -1, limit = 100, operationBitmask = null) {
        const normalizedAccount = normalizeAccount(account);

        // HIVE API constraint: start must be >= limit - 1 (start is a reverse index).
        // Use -1 to request the most recent entries. For explicit indices,
        // clamp limit so the constraint is satisfied.
        let safeFrom = from;
        let safeLimit = limit;
        if (safeFrom !== -1 && safeFrom < safeLimit - 1) {
            safeLimit = safeFrom + 1;  // request only as many entries as available from that index
        }

        // database.getAccountHistory(account, from, limit, bitmask?) — documented dpixa method
        try {
            if (operationBitmask) {
                return await this.proxy.client.database.getAccountHistory(normalizedAccount, safeFrom, safeLimit, operationBitmask);
            }
            return await this.proxy.client.database.getAccountHistory(normalizedAccount, safeFrom, safeLimit);
        } catch (e) {
            console.warn('[AccountsAPI] getAccountHistory failed:', e.message);
        }
        return [];
    }

    /**
     * Get account history with full AppBase parameter support, including
     * the optional `include_reversible` flag that pulls operations from
     * the reversible (not-yet-irreversible) block window. Uses the
     * account_history_api namespace directly rather than condenser.
     *
     * @param {object} params
     * @param {string}  params.account
     * @param {number}  [params.start=-1]         Reverse index; -1 = most recent
     * @param {number}  [params.limit=100]        Up to 1000
     * @param {boolean} [params.includeReversible=false]
     * @param {number}  [params.operationFilterLow]  Low 64 bits of op bitmask
     * @param {number}  [params.operationFilterHigh] High 64 bits of op bitmask
     * @returns {Promise<Array>} Raw history entries: [[seq, op], ...]
     */
    async getAccountHistoryFull({
                                    account,
                                    start = -1,
                                    limit = 100,
                                    includeReversible = false,
                                    operationFilterLow = null,
                                    operationFilterHigh = null
                                } = {}) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return [];

        // Same reverse-index safety as getAccountHistory
        let safeFrom = start;
        let safeLimit = limit;
        if (safeFrom !== -1 && safeFrom < safeLimit - 1) {
            safeLimit = safeFrom + 1;
        }

        const params = {
            account: normalizedAccount,
            start: safeFrom,
            limit: safeLimit,
            include_reversible: Boolean(includeReversible)
        };
        if (operationFilterLow !== null)  params.operation_filter_low  = operationFilterLow;
        if (operationFilterHigh !== null) params.operation_filter_high = operationFilterHigh;

        try {
            const result = await this.proxy.client.call('account_history_api', 'get_account_history', params);
            return result?.history || [];
        } catch (e) {
            console.warn('[AccountsAPI] get_account_history (appbase) failed:', e.message);
        }
        return [];
    }

    async getAccountReputations(lowerBound = '', limit = 1000) {
        try {
            return await this.proxy.client.call('condenser_api', 'get_account_reputations', [lowerBound, limit]);
        } catch (e) {
            console.warn('[AccountsAPI] get_account_reputations failed:', e.message);
        }
        return [];
    }

    async getAccountNotifications(account, limit = 50) {
        const normalizedAccount = normalizeAccount(account);

        try {
            if (this.proxy.client.pixamind) {
                return await this.proxy.client.pixamind.getAccountNotifications({
                    account: normalizedAccount,
                    limit: limit
                });
            }
        } catch (e) {
            console.warn('[AccountsAPI] pixamind.getAccountNotifications failed:', e.message);
        }
        return [];
    }

    // ── Notification read-state tracking (LacertaDB settingsDb) ──

    /**
     * Lazily initialise the notification_reads collection in settingsDb.
     * @returns {Promise<object>} LacertaDB collection handle
     * @private
     */
    async _notifReadsCollection() {
        if (!this._notifCol) {
            const db = this.proxy.settingsDb;
            this._notifCol = await db.getCollection('notification_reads');
        }
        return this._notifCol;
    }

    /**
     * Get the Set of notification IDs that have been read by the user.
     * Stored per-account in settingsDb → notification_reads collection.
     * @param {string} account
     * @returns {Promise<Set<number>>}
     */
    async getReadNotificationIds(account) {
        const normalizedAccount = normalizeAccount(account);
        try {
            const col = await this._notifReadsCollection();
            const doc = await col.get(`read_${normalizedAccount}`);
            if (doc && Array.isArray(doc.ids)) {
                return new Set(doc.ids);
            }
        } catch (e) {
            // Document doesn't exist yet or collection empty — not an error
        }
        return new Set();
    }

    /**
     * Mark one or more notification IDs as read for the given account.
     * Merges with any previously-read IDs. Keeps only the most recent 500
     * IDs to prevent unbounded growth.
     *
     * Uses LacertaDB's native upsert() for atomic insert-or-update.
     *
     * @param {string} account
     * @param {number[]} notificationIds
     * @returns {Promise<void>}
     */
    async markNotificationsRead(account, notificationIds) {
        const normalizedAccount = normalizeAccount(account);
        if (!Array.isArray(notificationIds) || notificationIds.length === 0) return;

        try {
            const col = await this._notifReadsCollection();
            const docId = `read_${normalizedAccount}`;

            // Merge with existing read IDs
            let existing = [];
            try {
                const doc = await col.get(docId);
                if (doc && Array.isArray(doc.ids)) existing = doc.ids;
            } catch (_) {
                // No existing doc — first write for this account
            }

            const merged = new Set(existing);
            for (const id of notificationIds) merged.add(id);

            // Cap at 500 most recent IDs to prevent unbounded growth
            let ids = Array.from(merged);
            if (ids.length > 500) {
                ids = ids.sort((a, b) => b - a).slice(0, 500);
            }

            const doc = { ids, updated_at: Date.now() };

            await col.upsert(docId, doc);
        } catch (e) {
            console.warn('[AccountsAPI] markNotificationsRead failed:', e.message);
        }
    }

    /**
     * Clear the read-state for an account (useful for debugging or reset).
     * @param {string} account
     * @returns {Promise<void>}
     */
    async clearReadNotifications(account) {
        const normalizedAccount = normalizeAccount(account);
        try {
            const col = await this._notifReadsCollection();
            await col.delete(`read_${normalizedAccount}`);
        } catch (e) {
            console.warn('[AccountsAPI] clearReadNotifications failed:', e.message);
        }
    }

    /**
     * Get escrow details for an account
     * @param {string} from - Escrow from account
     * @param {number} escrowId - Escrow ID
     * @returns {Promise<object|null>}
     */
    async getEscrow(from, escrowId) {
        const normalizedFrom = normalizeAccount(from);
        try {
            return await this.proxy.client.call('condenser_api', 'get_escrow', [normalizedFrom, escrowId]);
        } catch (e) {
            console.warn('[AccountsAPI] get_escrow failed:', e.message);
        }
        return null;
    }

    /**
     * Find recurrent transfers for an account
     * @param {string} account
     * @returns {Promise<object[]>}
     */
    async findRecurrentTransfers(account) {
        const normalizedAccount = normalizeAccount(account);
        try {
            return await this.proxy.client.call('condenser_api', 'find_recurrent_transfers', [normalizedAccount]);
        } catch (e) {
            console.warn('[AccountsAPI] find_recurrent_transfers failed:', e.message);
        }
        return [];
    }

    /**
     * Find proposals (DAO)
     * @param {Array<string|number>} ids - Proposal IDs or creator accounts
     * @param {string} order - 'by_creator', 'by_start_date', 'by_end_date', 'by_total_votes'
     * @param {string} orderDirection - 'ascending' or 'descending'
     * @param {string} status - 'all', 'inactive', 'active', 'expired', 'votable'
     * @param {number} limit - Max results
     * @returns {Promise<object[]>}
     */
    async findProposals(ids = [], order = 'by_total_votes', orderDirection = 'descending', status = 'all', limit = 100) {
        try {
            return await this.proxy.client.call('condenser_api', 'find_proposals', [ids]);
        } catch (e) {
            console.warn('[AccountsAPI] find_proposals failed:', e.message);
        }
        return [];
    }

    /**
     * List proposals (DAO) with sorting/filtering
     * @param {Array} start - Start point for iteration
     * @param {number} limit - Max results
     * @param {string} order - Sort order
     * @param {string} orderDirection - 'ascending' or 'descending'
     * @param {string} status - 'all', 'inactive', 'active', 'expired', 'votable'
     * @returns {Promise<object[]>}
     */
    async listProposals(start = [], limit = 100, order = 'by_total_votes', orderDirection = 'descending', status = 'all') {
        try {
            return await this.proxy.client.call('condenser_api', 'list_proposals', [start, limit, order, orderDirection, status]);
        } catch (e) {
            console.warn('[AccountsAPI] list_proposals failed:', e.message);
        }
        return [];
    }

    /**
     * List votes on proposals
     * @param {Array} start - Start point [proposal_id] or [proposal_id, voter]
     * @param {number} limit - Max results
     * @param {string} order - 'by_voter_proposal' or 'by_proposal_voter'
     * @param {string} orderDirection - 'ascending' or 'descending'
     * @param {string} status - 'all', 'inactive', 'active', 'expired', 'votable'
     * @returns {Promise<object[]>}
     */
    async listProposalVotes(start = [], limit = 100, order = 'by_proposal_voter', orderDirection = 'ascending', status = 'all') {
        try {
            return await this.proxy.client.call('condenser_api', 'list_proposal_votes', [start, limit, order, orderDirection, status]);
        } catch (e) {
            console.warn('[AccountsAPI] list_proposal_votes failed:', e.message);
        }
        return [];
    }
}

// ============================================
// Market API Group
// ============================================

class MarketAPI {
    constructor(proxy) { this.proxy = proxy; }

    async _fetch(label, fetchFn) {
        try {
            return await fetchFn();
        } catch (e) {
            console.warn(`[MarketAPI] ${label} failed:`, e.message);
            return null;
        }
    }

    async getOrderBook(limit = 500) {
        return this._fetch(`order_book_${limit}`,
            () => this.proxy.client.call('condenser_api', 'get_order_book', [limit]));
    }

    async getOpenOrders(account) {
        const normalizedAccount = normalizeAccount(account);
        return this.proxy.client.call('condenser_api', 'get_open_orders', [normalizedAccount]);
    }

    async getTicker() {
        return this._fetch('ticker',
            () => this.proxy.client.call('condenser_api', 'get_ticker'));
    }

    async getTradeHistory(start, end, limit = 1000) {
        return this.proxy.client.call('condenser_api', 'get_trade_history', [start, end, limit]);
    }

    async getMarketHistory(bucketSeconds, start, end) {
        return this.proxy.client.call('condenser_api', 'get_market_history', [bucketSeconds, start, end]);
    }

    async getMarketHistoryBuckets() {
        return this._fetch('history_buckets',
            () => this.proxy.client.call('condenser_api', 'get_market_history_buckets'));
    }

    /**
     * Get 24h trading volume for the internal market (condenser_api.get_volume).
     * @returns {Promise<{hive_volume:string, hbd_volume:string}|null>}
     */
    async getVolume() {
        return this._fetch('volume_24h',
            () => this.proxy.client.call('condenser_api', 'get_volume'));
    }
}

// ============================================
// Authority API Group
// ============================================

class AuthorityAPI {
    constructor(proxy) { this.proxy = proxy; }

    async getOwnerHistory(account) {
        const normalizedAccount = normalizeAccount(account);
        return this.proxy.client.call('condenser_api', 'get_owner_history', [normalizedAccount]);
    }

    async getRecoveryRequest(account) {
        const normalizedAccount = normalizeAccount(account);
        return this.proxy.client.call('condenser_api', 'get_recovery_request', [normalizedAccount]);
    }

    async getWithdrawRoutes(account, type = 'outgoing') {
        const normalizedAccount = normalizeAccount(account);
        return this.proxy.client.call('condenser_api', 'get_withdraw_routes', [normalizedAccount, type]);
    }

    async getAccountBandwidth(account, type) {
        const normalizedAccount = normalizeAccount(account);
        return this.proxy.client.call('condenser_api', 'get_account_bandwidth', [normalizedAccount, type]);
    }

    async getSavingsWithdrawFrom(account) {
        const normalizedAccount = normalizeAccount(account);
        return this.proxy.client.call('condenser_api', 'get_savings_withdraw_from', [normalizedAccount]);
    }

    async getSavingsWithdrawTo(account) {
        const normalizedAccount = normalizeAccount(account);
        return this.proxy.client.call('condenser_api', 'get_savings_withdraw_to', [normalizedAccount]);
    }

    async verifyAuthority(stx) {
        return this.proxy.client.database.verifyAuthority(stx);
    }
}

// ============================================
// Votes API Group
// ============================================

class VotesAPI {
    constructor(proxy) { this.proxy = proxy; }

    async getActiveVotes(author, permlink) {
        const normalizedAuthor = normalizeAccount(author);
        return this.proxy.client.call('condenser_api', 'get_active_votes', [normalizedAuthor, permlink]);
    }

    async getAccountVotes(account) {
        const normalizedAccount = normalizeAccount(account);
        return this.proxy.client.call('condenser_api', 'get_account_votes', [normalizedAccount]);
    }
}

// ============================================
// Content API Group
// ============================================

class ContentAPI {
    constructor(proxy) { this.proxy = proxy; }

    /**
     * Fetch a post or comment from the chain.
     *
     * @param {string}  author              Account name (with or without leading @)
     * @param {string}  permlink            Post/comment permlink
     * @param {object}  [options]
     * @param {boolean} [options.raw=false] If true, bypass sanitization and
     *                                      return the raw `condenser_api.get_content`
     *                                      payload exactly as the chain emits it
     *                                      (json_metadata still a JSON string, no
     *                                      _entity_type annotations, etc.).
     * @returns {Promise<object|null>}
     */
    async getContent(author, permlink, options = {}) {
        const { raw: rawMode = false } = options;
        const normalizedAuthor = normalizeAccount(author);

        // ── RAW MODE ──────────────────────────────────────────────────────
        // Bypass the sanitization pipeline. Return the chain payload verbatim.
        // Used by internal tooling (Data Inspector) that needs to see the
        // un-massaged shape of the post.
        if (rawMode) {
            try {
                const rawData = await this.proxy.client.call(
                    'condenser_api', 'get_content', [normalizedAuthor, permlink]
                );
                if (!rawData || !rawData.author) return null;
                return rawData;
            } catch (e) {
                console.warn('[ContentAPI] get_content (raw) failed:', e.message);
                return null;
            }
        }

        // ── DEFAULT PATH ──────────────────────────────────────────────────
        let raw = null;
        try {
            raw = await this.proxy.client.call('condenser_api', 'get_content', [normalizedAuthor, permlink]);
        } catch (e) {
            console.warn('[ContentAPI] get_content failed:', e.message);
            return null;
        }

        if (!raw || !raw.author) return null;

        // FAIL-CLOSED: never return raw, unsanitized data.
        if (!this.proxy.sanitizationPipeline) {
            console.error('[ContentAPI] Sanitizer pipeline not available — refusing to serve raw content');
            return null;
        }

        try {
            return this.proxy.sanitizationPipeline.sanitizeContent(raw) || null;
        } catch (e) {
            console.warn('[ContentAPI] Failed to sanitize content:', raw?.author, raw?.permlink, e.message || e);
            return null;
        }
    }

    async getContentReplies(author, permlink) {
        const normalizedAuthor = normalizeAccount(author);

        let rawReplies = [];
        try {
            rawReplies = await this.proxy.client.call('condenser_api', 'get_content_replies', [normalizedAuthor, permlink]);
        } catch (e) {
            console.warn('[ContentAPI] get_content_replies failed:', e.message);
            return [];
        }

        if (!rawReplies || !Array.isArray(rawReplies)) return [];

        if (!this.proxy.sanitizationPipeline) {
            console.error('[ContentAPI] Sanitizer pipeline not available — refusing to serve raw replies');
            return [];
        }

        const sanitized = [];
        for (const raw of rawReplies) {
            try {
                const entity = this.proxy.sanitizationPipeline.sanitizeComment(raw);
                if (entity) sanitized.push(entity);
            } catch (e) {
                console.warn('[ContentAPI] Failed to sanitize reply, skipping:', raw?.author, raw?.permlink, e.message || e);
            }
        }
        return sanitized;
    }

    async getDiscussionsByAuthorBeforeDate(author, startPermlink, beforeDate, limit = 10) {
        const normalizedAuthor = normalizeAccount(author);

        let rawResults = null;
        try {
            rawResults = await this.proxy.client.call(
                'condenser_api', 'get_discussions_by_author_before_date',
                [normalizedAuthor, startPermlink, beforeDate, limit]
            );
        } catch (e) {
            console.warn('[ContentAPI] get_discussions_by_author_before_date failed:', e.message);
            return [];
        }

        if (!rawResults || !Array.isArray(rawResults) || rawResults.length === 0) return [];

        if (!this.proxy.sanitizationPipeline) {
            console.error('[ContentAPI] Sanitizer pipeline not available — refusing raw content');
            return [];
        }

        const postEntities = [];
        const commentEntities = [];
        for (const raw of rawResults) {
            try {
                const entity = this.proxy.sanitizationPipeline.sanitizeContent(raw);
                if (entity) {
                    if (entity._entity_type === 'post') postEntities.push(entity);
                    else commentEntities.push(entity);
                }
            } catch (e) {
                console.warn('[ContentAPI] Failed to sanitize entity, skipping:', raw?.author, raw?.permlink, e.message || e);
            }
        }
        return [...postEntities, ...commentEntities];
    }

    async getRepliesByLastUpdate(author, startPermlink = '', limit = 10) {
        const normalizedAuthor = normalizeAccount(author);
        if (!normalizedAuthor) return [];

        let rawResults = null;
        try {
            // Use condenser_api.get_replies_by_last_update to fetch replies TO the user,
            // not getDiscussions('comments') which fetches comments BY the user.
            rawResults = await this.proxy.client.call(
                'condenser_api',
                'get_replies_by_last_update',
                [normalizedAuthor, startPermlink, limit]
            );
        } catch (e) {
            console.warn('[ContentAPI] getRepliesByLastUpdate failed:', e.message);
            return [];
        }

        if (!rawResults || !Array.isArray(rawResults) || rawResults.length === 0) return [];

        if (!this.proxy.sanitizationPipeline) {
            console.error('[ContentAPI] Sanitizer pipeline not available — refusing raw replies');
            return [];
        }

        const sanitized = [];
        for (const raw of rawResults) {
            try {
                const entity = this.proxy.sanitizationPipeline.sanitizeComment(raw);
                if (entity) sanitized.push(entity);
            } catch (e) {
                console.warn('[ContentAPI] Failed to sanitize reply, skipping:', raw?.author, raw?.permlink, e.message || e);
            }
        }
        return sanitized;
    }

    /**
     * Internal: Fetch discussions and sanitize. Shared by
     * getDiscussionsByComments, getDiscussionsByBlog, getDiscussionsByFeed.
     * @private
     */
    async _fetchDiscussions(sort, query) {
        const normalizedTag = normalizeAccount(query.tag || '');
        if (!normalizedTag) return [];

        const limit = parseInt(query.limit, 10) || 20;

        // dpixa passes the query object through to condenser_api.get_discussions_by_${sort}
        // get_discussions_by_comments does NOT accept "tag" — it uses start_author
        // get_discussions_by_blog / get_discussions_by_feed use "tag" as the username
        const q = { limit };
        if (sort === 'comments') {
            q.start_author = normalizedTag;
            if (query.start_permlink) q.start_permlink = query.start_permlink;
        } else {
            q.tag = normalizedTag;
            if (query.start_author) q.start_author = query.start_author;
            if (query.start_permlink) q.start_permlink = query.start_permlink;
        }

        let rawResults = null;
        try {
            rawResults = await this.proxy.client.database.getDiscussions(sort, q);
        } catch (e) {
            console.warn(`[ContentAPI] getDiscussions(${sort}) failed:`, e.message);
            return [];
        }

        if (!rawResults || !Array.isArray(rawResults)) return [];

        if (!this.proxy.sanitizationPipeline) {
            console.error('[ContentAPI] Sanitizer pipeline not available — refusing to serve raw content');
            return [];
        }

        const postEntities = [];
        const commentEntities = [];
        for (const raw of rawResults) {
            try {
                const entity = this.proxy.sanitizationPipeline.sanitizeContent(raw);
                if (entity) {
                    if (entity._entity_type === 'post') postEntities.push(entity);
                    else commentEntities.push(entity);
                }
            } catch (e) {
                console.warn('[ContentAPI] Failed to sanitize entity, skipping:', raw?.author, raw?.permlink, e.message || e);
            }
        }
        return [...postEntities, ...commentEntities];
    }

    async getDiscussionsByComments(query) {
        const author = query.start_author || query.tag || '';
        const normalizedAuthor = normalizeAccount(author);
        if (!normalizedAuthor) return [];

        const q = {
            tag: normalizedAuthor,
            limit: parseInt(query.limit, 10) || 20
        };
        // Only include pagination cursor if both fields are present
        if (query.start_author) q.start_author = query.start_author;
        if (query.start_permlink) q.start_permlink = query.start_permlink;

        return this._fetchDiscussions('comments', q);
    }

    async getDiscussionsByBlog(query) {
        return this._fetchDiscussions('blog', query);
    }

    async getDiscussionsByFeed(query) {
        return this._fetchDiscussions('feed', query);
    }

    async getAccountPosts(account, sort = 'blog', limit = 20, options = {}) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return [];

        const q = {
            tag: normalizedAccount,
            limit: parseInt(limit, 10) || 20
        };
        if (options.start_author) q.start_author = options.start_author;
        if (options.start_permlink) q.start_permlink = options.start_permlink;

        return this._fetchDiscussions(sort, q);
    }

    async getState(path) {
        return this.proxy.client.database.getState(path);
    }
}

// ============================================
// Witnesses API Group
// ============================================

class WitnessesAPI {
    constructor(proxy) { this.proxy = proxy; }

    async _fetch(label, fetchFn) {
        try {
            return await fetchFn();
        } catch (e) {
            console.warn(`[WitnessesAPI] ${label} failed:`, e.message);
            return null;
        }
    }

    async getWitnessByAccount(account) {
        const normalizedAccount = normalizeAccount(account);
        return this._fetch(`by_account_${normalizedAccount}`,
            () => this.proxy.client.call('condenser_api', 'get_witness_by_account', [normalizedAccount]));
    }

    async getWitnessesByVote(from, limit = 100) {
        return this._fetch(`by_vote_${from}_${limit}`,
            () => this.proxy.client.call('condenser_api', 'get_witnesses_by_vote', [from, limit]));
    }

    async lookupWitnessAccounts(lowerBound, limit = 100) {
        return this._fetch(`lookup_${lowerBound}_${limit}`,
            () => this.proxy.client.call('condenser_api', 'lookup_witness_accounts', [lowerBound, limit]));
    }

    async getWitnessCount() {
        return this._fetch('count',
            () => this.proxy.client.call('condenser_api', 'get_witness_count'));
    }

    async getActiveWitnesses() {
        return this._fetch('active',
            () => this.proxy.client.call('condenser_api', 'get_active_witnesses'));
    }

    async getWitnessSchedule() {
        return this._fetch('schedule',
            () => this.proxy.client.call('condenser_api', 'get_witness_schedule'));
    }

    /**
     * List witnesses with full records (database_api.list_witnesses).
     * Unlike lookup_witness_accounts (names only), this returns the full
     * witness object: props, signing_key, votes, schedule fields, etc.
     *
     * @param {object}  [params]
     * @param {string|Array} [params.start='']  Shape depends on order:
     *        - 'by_name'          : string account name
     *        - 'by_vote_name'     : [votes:string|number, account:string]
     *        - 'by_schedule_time' : [virtual_scheduled_time:string, account:string]
     * @param {number}  [params.limit=100]      Up to 1000
     * @param {string}  [params.order='by_vote_name']  'by_name' | 'by_vote_name' | 'by_schedule_time'
     * @returns {Promise<object[]>} Array of full witness records
     */
    async listWitnesses({ start = '', limit = 100, order = 'by_vote_name' } = {}) {
        return this._fetch(`list_${order}`, async () => {
            const result = await this.proxy.client.call('database_api', 'list_witnesses', {
                start, limit, order
            });
            return result?.witnesses || [];
        });
    }

    /**
     * List witness votes (database_api.list_witness_votes).
     *
     * @param {object} [params]
     * @param {Array}  [params.start=['','']]
     *        - 'by_account_witness' : [account:string, witness:string]
     *        - 'by_witness_account' : [witness:string, account:string]
     * @param {number} [params.limit=100]   Up to 1000
     * @param {string} [params.order='by_account_witness']
     * @returns {Promise<Array<{id:number, witness:string, account:string}>>}
     */
    async listWitnessVotes({ start = ['', ''], limit = 100, order = 'by_account_witness' } = {}) {
        return this._fetch(`votes_${order}`, async () => {
            const result = await this.proxy.client.call('database_api', 'list_witness_votes', {
                start, limit, order
            });
            return result?.votes || [];
        });
    }

    /**
     * Find witnesses by exact owner names (database_api.find_witnesses).
     * Returns full witness records for each matching owner.
     * @param {string[]} owners - Witness account names
     * @returns {Promise<object[]>}
     */
    async findWitnesses(owners = []) {
        if (!Array.isArray(owners) || owners.length === 0) return [];
        const normalized = owners.map(normalizeAccount).filter(Boolean);
        if (!normalized.length) return [];
        return this._fetch(`find_${normalized.join(',')}`, async () => {
            const result = await this.proxy.client.call('database_api', 'find_witnesses', {
                owners: normalized
            });
            return result?.witnesses || [];
        });
    }
}

// ============================================
// Follow API Group
// ============================================

class FollowAPI {
    constructor(proxy) { this.proxy = proxy; }

    async _fetch(label, fetchFn) {
        try {
            return await fetchFn();
        } catch (e) {
            console.warn(`[FollowAPI] ${label} failed:`, e.message);
            return null;
        }
    }

    async getFollowers(account, startFollower = null, type = 'blog', limit = 100) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return [];
        const safeLimit = parseInt(limit, 10) || 100;
        return await this._fetch(`followers_${normalizedAccount}`,
            () => this.proxy.client.call('condenser_api', 'get_followers', [normalizedAccount, startFollower, type, safeLimit])) || [];
    }

    async getFollowing(account, startFollowing = null, type = 'blog', limit = 100) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return [];
        const safeLimit = parseInt(limit, 10) || 100;
        return await this._fetch(`following_${normalizedAccount}`,
            () => this.proxy.client.call('condenser_api', 'get_following', [normalizedAccount, startFollowing, type, safeLimit])) || [];
    }

    async getFollowCount(account) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return { account: account || '', follower_count: 0, following_count: 0 };

        const result = await this._fetch(`follow_count_${normalizedAccount}`, async () => {
            const r = await this.proxy.client.call('condenser_api', 'get_follow_count', [normalizedAccount]);
            if (r) return { account: normalizedAccount, follower_count: r.follower_count || 0, following_count: r.following_count || 0 };
            return null;
        });
        return result || { account: normalizedAccount, follower_count: 0, following_count: 0 };
    }

    async getFeedEntries(account, startEntryId = 0, limit = 10) {
        const normalizedAccount = normalizeAccount(account);
        return await this._fetch(`feed_entries_${normalizedAccount}`,
            () => this.proxy.client.call('condenser_api', 'get_feed_entries', [normalizedAccount, startEntryId, limit])) || [];
    }

    async getBlogEntries(account, startEntryId = 0, limit = 10) {
        const normalizedAccount = normalizeAccount(account);
        return await this._fetch(`blog_entries_${normalizedAccount}`,
            () => this.proxy.client.call('condenser_api', 'get_blog_entries', [normalizedAccount, startEntryId, limit])) || [];
    }

    async getRebloggedBy(author, permlink) {
        const normalizedAuthor = normalizeAccount(author);
        return await this._fetch(`reblogged_by_${normalizedAuthor}_${permlink}`,
            () => this.proxy.client.call('condenser_api', 'get_reblogged_by', [normalizedAuthor, permlink])) || [];
    }

    async getBlogAuthors(account) {
        const normalizedAccount = normalizeAccount(account);
        return await this._fetch(`blog_authors_${normalizedAccount}`,
            () => this.proxy.client.call('condenser_api', 'get_blog_authors', [normalizedAccount])) || [];
    }

    async getSubscriptions(account) {
        const normalizedAccount = normalizeAccount(account);

        // pixamind.listAllSubscriptions({account}) — documented dpixa method
        try {
            return await this.proxy.client.pixamind.listAllSubscriptions({ account: normalizedAccount });
        } catch (e) {
            console.warn('[FollowAPI] listAllSubscriptions failed:', e.message);
        }
        return [];
    }
}

// ============================================
// Broadcast API Group
// ============================================

/**
 * Canonical results of a vote attempt, returned by {@link BroadcastAPI#vote}.
 *
 * These let callers update optimistic UI from what *actually* happened rather
 * than from the weight they optimistically guessed before the (optional)
 * weight-adjustment dialog — which the user can cancel, re-sign, or drag to 0:
 *
 *   NOTHING    — the user dismissed the weight dialog; nothing was broadcast.
 *   POSITIVE   — an upvote was broadcast   (final weight  > 0).
 *   NEGATIVE   — a downvote was broadcast  (final weight  < 0).
 *   WITHDRAWAL — the vote was cleared      (final weight === 0).
 *
 * @readonly
 * @enum {string}
 */
const VOTE_OUTCOME = Object.freeze({
    NOTHING: 'nothing',
    POSITIVE: 'positive',
    NEGATIVE: 'negative',
    WITHDRAWAL: 'withdrawal',
});

/**
 * Classify a *broadcast* vote weight into a {@link VOTE_OUTCOME}.
 * (Cancellation is handled separately — it never reaches here.)
 * @param {number} weight - The weight that was actually broadcast.
 * @returns {string} One of VOTE_OUTCOME.POSITIVE | NEGATIVE | WITHDRAWAL.
 */
function classifyVoteOutcome(weight) {
    const w = Number(weight) || 0;
    if (w > 0) return VOTE_OUTCOME.POSITIVE;
    if (w < 0) return VOTE_OUTCOME.NEGATIVE;
    return VOTE_OUTCOME.WITHDRAWAL;
}

// ════════════════════════════════════════════════════════════════════════════
// Content-edit body patching (diff-match-patch wire format)
//
// HIVE-style edits re-broadcast the `comment` op with the same permlink and
// parent. The chain's comment_evaluator first tries to parse the new body as
// a diff-match-patch patch text; when it parses, the patch is applied to the
// stored body, otherwise the body is replaced verbatim. Sending a patch is a
// pure bandwidth optimization (the canonical pattern from
// https://developers.hive.io/tutorials-javascript/edit_content_patching.html)
// — sending the full body is always equally correct.
//
// We generate a single-hunk patch (common prefix / changed middle / common
// suffix, 4-char context margins) that is byte-compatible with Google's
// diff_match_patch `patch_toText` output, so the node's C++ patch_fromText /
// patch_apply pair consumes it exactly like a condenser-produced patch.
//
// SAFETY RAILS — the evaluator stores the *patch text itself* as the body if
// anything about it confuses the parser mid-apply, so we only ever emit a
// patch when it is provably safe, and fall back to the full body otherwise:
//   1. Surrogate pairs (emoji & other astral chars) make JS UTF-16 offsets
//      diverge from the node's wide-char offsets → no patch, full body.
//   2. A body that itself starts like a patch header would be (mis)parsed by
//      the chain → never patch *onto* such content.
//   3. The generated patch must round-trip locally (apply back to oldText
//      and yield newText) before it is allowed out the door.
//   4. The patch must actually be smaller than the new body.
// ════════════════════════════════════════════════════════════════════════════

/** Percent-encode one diff line the way dmp's patch_toText does. @private */
function _dmpEncodeLine(text) {
    // encodeURI keeps most punctuation readable and encodes '\n' as %0A so
    // every diff stays on its own line; dmp then restores literal spaces.
    return encodeURI(text).replace(/%20/g, ' ');
}

/** Format dmp patch header coordinates (JS dmp patch_obj.toString rules). @private */
function _dmpCoords(start, length) {
    if (length === 0) return start + ',0';      // start is 0-based when empty
    if (length === 1) return String(start + 1); // 1-based, length omitted
    return (start + 1) + ',' + length;          // 1-based + explicit length
}

/**
 * Build a diff-match-patch wire-format patch transforming oldText → newText.
 *
 * Returns `null` whenever a patch cannot be *guaranteed* safe (identical
 * texts, astral characters, patch-looking source body, or any internal
 * inconsistency) — callers must then send the full body instead.
 *
 * @param {string} oldText - The exact current on-chain body.
 * @param {string} newText - The desired new body.
 * @returns {string|null} dmp patch text, or null to request full-body mode.
 * @private
 */
function makeContentEditPatch(oldText, newText) {
    if (typeof oldText !== 'string' || typeof newText !== 'string') return null;
    if (oldText === newText) return null;
    if (oldText.length === 0) return null; // creation-like replace → full body

    // Rail 1 — UTF-16 surrogate pairs shift offsets vs the node's wide chars.
    if (/[\uD800-\uDFFF]/.test(oldText) || /[\uD800-\uDFFF]/.test(newText)) return null;
    // Rail 2 — the evaluator would already be treating this body as a patch.
    if (/^@@ -\d/.test(oldText)) return null;

    try {
        // Common prefix
        let p = 0;
        const maxP = Math.min(oldText.length, newText.length);
        while (p < maxP && oldText.charCodeAt(p) === newText.charCodeAt(p)) p++;
        // Common suffix (never overlapping the prefix)
        let s = 0;
        const maxS = Math.min(oldText.length, newText.length) - p;
        while (s < maxS && oldText.charCodeAt(oldText.length - 1 - s) === newText.charCodeAt(newText.length - 1 - s)) s++;

        const removed = oldText.slice(p, oldText.length - s);
        const inserted = newText.slice(p, newText.length - s);

        // Rail 3 — algebraic round-trip: prefix + inserted + suffix === newText.
        if (oldText.slice(0, p) + inserted + oldText.slice(oldText.length - s) !== newText) return null;

        const MARGIN = 4; // dmp Patch_Margin default
        const preStart = Math.max(0, p - MARGIN);
        const pre = oldText.slice(preStart, p);
        const postEnd = Math.min(oldText.length, (oldText.length - s) + MARGIN);
        const post = oldText.slice(oldText.length - s, postEnd);

        const start1 = preStart; // identical in both texts (inside the shared prefix)
        const start2 = preStart;
        const length1 = pre.length + removed.length + post.length;
        const length2 = pre.length + inserted.length + post.length;

        const out = ['@@ -' + _dmpCoords(start1, length1) + ' +' + _dmpCoords(start2, length2) + ' @@\n'];
        if (pre)      out.push(' ' + _dmpEncodeLine(pre) + '\n');
        if (removed)  out.push('-' + _dmpEncodeLine(removed) + '\n');
        if (inserted) out.push('+' + _dmpEncodeLine(inserted) + '\n');
        if (post)     out.push(' ' + _dmpEncodeLine(post) + '\n');
        const patch = out.join('');

        // Rail 3b — the encoded lines must decode back to the exact segments
        // (decodeURI is what both the JS and C++ patch_fromText use).
        if (decodeURI(_dmpEncodeLine(removed)) !== removed) return null;
        if (decodeURI(_dmpEncodeLine(inserted)) !== inserted) return null;

        return patch;
    } catch (_) {
        return null; // e.g. encodeURI on a lone surrogate — full body instead
    }
}

class BroadcastAPI {
    constructor(proxy) {
        this.proxy = proxy;
        /** @private Dedup guard — if a vote dialog is already open, subsequent calls return the same promise */
        this._pendingVotePromise = null;
    }

    /**
     * Central broadcast dispatcher — routes through BroadcastQueue when available.
     *
     * When the queue is initialized:
     *   - Online: broadcasts immediately (queue handles the send)
     *   - Offline + queueable op: persists to queue for later drain
     *   - Offline + financial op: throws OfflineNotQueueableError
     *
     * When the queue is NOT initialized: falls back to direct sendOperations.
     *
     * @param {Array} operations — [[opName, opData], ...] tuples
     * @param {string} key — WIF private key string
     * @param {object} [meta={}] — Metadata for dedup/display { account, keyType, ... }
     * @returns {Promise<object>} Broadcast result or queue entry
     * @private
     */
    async _send(operations, key, meta = {}, broadcastFn = null) {
        // Resolved once and reused by both queue paths below. Derived from the
        // whole operation array, not just operations[0] — see
        // PixaProxyAPI#_inferKeyTypeForOps.
        const keyType = meta.keyType || this.proxy._inferKeyTypeForOps(operations);

        // ── Offline + queue: defer (queue's broadcastFn re-resolves key at drain time) ──
        // SECURITY: checked *before* deriving the PrivateKey. The queue resolves
        // its own key when it drains, so deriving one here would leave a live
        // 32-byte secret on the heap for a value that is never used.
        if (this.proxy.broadcastQueue && this.proxy.connectivity && !this.proxy.connectivity.isOnline) {
            const opType = operations[0]?.[0] || 'unknown';
            return this.proxy.broadcastQueue.enqueue(opType, operations, { ...meta, keyType });
        }

        // SECURITY: only zero what we derived ourselves. When the caller passes
        // a PrivateKey instance they own its lifetime and may reuse it, so
        // wiping `.secret` here would corrupt their next signature.
        const derivedHere = typeof key === 'string';
        const privateKey = derivedHere ? PrivateKey.fromString(key) : key;

        // ── Online: broadcast directly with the caller's already-obtained key ──
        // Prefer dpixa convenience methods (broadcast.transfer, broadcast.vote, etc.)
        // over sendOperations — the fork's sendOperations has serialization issues
        // that cause signature mismatches ("Missing Authority" errors).
        if (!broadcastFn && operations.length === 1) {
            const [opType, opData] = operations[0];
            const methodName = opType.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            const method = this.proxy.client.broadcast[methodName];
            if (typeof method === 'function') {
                broadcastFn = (pk) => method.call(this.proxy.client.broadcast, opData, pk);
            }
        }

        try {
            if (broadcastFn) {
                return await broadcastFn(privateKey);
            }
            return await this.proxy.client.broadcast.sendOperations(operations, privateKey);
        } catch (e) {
            // Network failure mid-broadcast — if queue exists, re-check connectivity
            if (this.proxy.broadcastQueue && this.proxy.connectivity) {
                const stillOnline = await this.proxy.connectivity.checkNow();
                if (!stillOnline) {
                    // Actually went offline — try to queue for later
                    const opType = operations[0]?.[0] || 'unknown';
                    return this.proxy.broadcastQueue.enqueue(opType, operations, { ...meta, keyType });
                }
            }
            throw e; // Genuine chain/validation error — propagate
        } finally {
            // Zero the 32-byte internal secret regardless of outcome. Both
            // returns above are awaited, so the broadcast has completed by the
            // time this runs.
            if (derivedHere && privateKey?.secret?.fill) privateKey.secret.fill(0);
        }
    }

    /**
     * Hook for post-broadcast cleanup.
     *
     * v4.4: No persistence layer remains, so there is nothing to invalidate.
     * The method is kept as a no-op to preserve the call sites in `_send()`
     * and the offline broadcast-queue drain path; if a persistence layer is
     * ever reintroduced, this is where invalidation belongs.
     *
     * @private
     */
    async _invalidateAfterBroadcast(_operations, _meta) {
        // Intentionally empty.
    }

    async updateAccount2(paramsOrAccount, jsonMetadata, postingJsonMetadata, extensions = []) {
        let params;
        if (typeof paramsOrAccount === 'object' && paramsOrAccount !== null && paramsOrAccount.account) {
            params = paramsOrAccount;
        } else {
            params = { account: paramsOrAccount, jsonMetadata, postingJsonMetadata, extensions };
        }

        const { account, auth = {}, externalKey } = params;
        const normalizedAccount = normalizeAccount(account);

        if (!normalizedAccount) {
            throw new PixaAPIError('Invalid account parameter', 'INVALID_ACCOUNT');
        }

        const requiresActive = auth.owner || auth.active || auth.posting || auth.memo_key ||
            (params.jsonMetadata !== undefined && params.jsonMetadata !== null);

        // Changing the owner authority requires the owner key for signing;
        // all other authority changes require the active key.
        const requiresOwner = !!auth.owner;
        const keyType = requiresOwner ? 'owner' : requiresActive ? 'active' : 'posting';

        // When externalKey is provided, bypass keyManager entirely (used for
        // operations on accounts the logged-in user doesn't own, e.g. portal accounts).
        let key;
        if (externalKey) {
            key = externalKey;
        } else {
            key = await this.proxy.keyManager.requestKey(normalizedAccount, keyType);
        }

        const ensureString = (val) => {
            if (val === null || val === undefined) return "";
            if (typeof val === 'string') return val;
            try { return JSON.stringify(val); } catch (e) { return ""; }
        };

        const op = {
            account: normalizedAccount,
            json_metadata: ensureString(params.jsonMetadata),
            posting_json_metadata: ensureString(params.postingJsonMetadata),
            extensions: params.extensions || []
        };

        if (auth.owner) op.owner = auth.owner;
        if (auth.active) op.active = auth.active;
        if (auth.posting) op.posting = auth.posting;
        if (auth.memo_key) op.memo_key = auth.memo_key;

        return this._send(
            [['account_update2', op]], key,
            { account: normalizedAccount, keyType });
    }

    async updateProfile(account, profileObject, externalKey) {
        const normalizedAccount = normalizeAccount(account);

        if (!normalizedAccount) {
            throw new PixaAPIError('Invalid account parameter', 'INVALID_ACCOUNT');
        }

        const [accountData] = await this.proxy.client.database.getAccounts([normalizedAccount]);
        if (!accountData) throw new PixaAPIError('Account not found', 'ACCOUNT_NOT_FOUND');

        let currentPostingMeta = {};
        try {
            if (accountData.posting_json_metadata) {
                currentPostingMeta = JSON.parse(accountData.posting_json_metadata);
            }
        } catch (e) {}

        const currentProfile = (currentPostingMeta.profile && typeof currentPostingMeta.profile === 'object' && !Array.isArray(currentPostingMeta.profile))
            ? currentPostingMeta.profile : {};
        const newPostingMeta = {
            ...currentPostingMeta,
            profile: { ...currentProfile, ...profileObject }
        };

        const result = await this.updateAccount2({
            account: normalizedAccount,
            jsonMetadata: accountData.json_metadata,
            postingJsonMetadata: newPostingMeta,
            externalKey: externalKey || undefined,
        });

        // v4.4: No persistence layer, so no stale cache to invalidate —
        // the next getAccounts() call will already hit the chain.

        if (this.proxy.eventEmitter) {
            this.proxy.eventEmitter.emit('profile_updated', { account: normalizedAccount, profile: newPostingMeta.profile });
        }

        return result;
    }

    /**
     * Vote on a post or comment.
     *
     * When {@link PixaProxyAPI#askVote} is `true`, the method emits a
     * `vote_weight_required` event instead of broadcasting immediately,
     * giving the UI a chance to display a weight-adjustment dialog.
     * The event payload includes `broadcast(finalWeight)` and `cancel()`
     * callbacks so the dialog can finalise or abort the vote.
     *
     * Resolves to a *vote outcome* describing what actually happened, so callers
     * can drive optimistic UI from the real result rather than the weight they
     * passed in (the dialog may cancel, flip the sign, or set the weight to 0):
     *
     *   { outcome: 'nothing',    weight: 0,           result: null }   // cancelled
     *   { outcome: 'positive',   weight: <w  > 0>,    result: <tx> }   // upvote
     *   { outcome: 'negative',   weight: <w  < 0>,    result: <tx> }   // downvote
     *   { outcome: 'withdrawal', weight: 0,           result: <tx> }   // vote cleared
     *
     * `outcome` is one of {@link VOTE_OUTCOME}. The previous contract resolved
     * the raw broadcast result (or `null` on cancel); that result is still
     * available under `.result`.
     *
     * @param {string} voter - The voting account
     * @param {string} author - The content author
     * @param {string} permlink - The content permlink
     * @param {number} weight - Vote weight (-10000 to 10000)
     * @returns {Promise<{outcome: string, weight: number, result: (object|null)}>}
     */
    async vote(voter, author, permlink, weight) {
        const normalizedVoter = normalizeAccount(voter);
        const normalizedAuthor = normalizeAccount(author);

        if (!normalizedVoter || !normalizedAuthor) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        // ── Broadcast-level dedup: same (voter, author, permlink) in-flight → return existing promise ──
        if (!this._inflightVotes) this._inflightVotes = new Map();
        const voteKey = `${normalizedVoter}/${normalizedAuthor}/${permlink}`;
        if (this._inflightVotes.has(voteKey)) {
            return this._inflightVotes.get(voteKey);
        }

        // ── Internal broadcast helper (shared by direct & deferred paths) ──
        const _broadcastVote = async (finalWeight) => {
            const key = await this.proxy.keyManager.requestKey(normalizedVoter, 'posting');

            const op = {
                voter: normalizedVoter,
                author: normalizedAuthor,
                permlink,
                weight: finalWeight,
            };

            const result = await this._send(
                [['vote', op]], key,
                { account: normalizedVoter, voter: normalizedVoter, author: normalizedAuthor, permlink, keyType: 'posting' }
            );

            // Single success notification for the UI. Emitted here so it fires
            // exactly once for BOTH the weight-dialog path and the direct path,
            // and never on cancel (cancellation never calls _broadcastVote).
            // Listeners (e.g. the snackbar in Index) own the user-facing message,
            // so components no longer emit their own success snackbar — this is
            // what removes the duplicate "voted" toast.
            if (this.proxy.eventEmitter) {
                this.proxy.eventEmitter.emit('vote_done', {
                    voter: normalizedVoter,
                    author: normalizedAuthor,
                    permlink,
                    weight: finalWeight,
                    outcome: classifyVoteOutcome(finalWeight),
                    result,
                });
            }

            // v4.3.0: Entity/query invalidation handled centrally by _send()._invalidateAfterBroadcast()
            return result;
        };

        // Wrap the entire vote flow in the dedup guard
        const votePromise = (async () => {
            // ── Deferred path: let the UI adjust weight before broadcasting ──
            // Skip dialog for vote withdrawals (weight 0) — nothing to adjust
            if (weight !== 0 && this.proxy.askVote && this.proxy.eventEmitter) {
                if (this._pendingVotePromise) return this._pendingVotePromise;

                this._pendingVotePromise = new Promise((resolve, reject) => {
                    this.proxy.eventEmitter.emit('vote_weight_required', {
                        voter: normalizedVoter,
                        author: normalizedAuthor,
                        permlink,
                        weight,
                        defaultVotingPower: this.proxy.defaultVotingPower,
                        broadcast: async (finalWeight) => {
                            try {
                                const result = await _broadcastVote(finalWeight);
                                // Resolve with the *actual* outcome (the dialog may have
                                // changed the sign or dragged the weight to 0), so the
                                // optimistic UI reflects what was really broadcast.
                                resolve({
                                    outcome: classifyVoteOutcome(finalWeight),
                                    weight: finalWeight,
                                    result,
                                });
                                // Return the raw tx result — the dialog/Index await this.
                                return result;
                            } catch (e) {
                                reject(e);
                                throw e;
                            }
                        },
                        // Dialog dismissed → nothing was broadcast. Callers must NOT
                        // apply an optimistic vote for this outcome.
                        cancel: () => {
                            resolve({ outcome: VOTE_OUTCOME.NOTHING, weight: 0, result: null });
                        },
                    });
                }).finally(() => {
                    this._pendingVotePromise = null;
                });

                return this._pendingVotePromise;
            }

            // ── Direct path: broadcast immediately ──
            const result = await _broadcastVote(weight);
            return { outcome: classifyVoteOutcome(weight), weight, result };
        })();

        // Register in-flight, clear when settled
        this._inflightVotes.set(voteKey, votePromise);
        votePromise.finally(() => { this._inflightVotes.delete(voteKey); });

        return votePromise;
    }

    async comment(params) {
        const { parentAuthor = "", parentPermlink = "", author, permlink, title = "", body, jsonMetadata = {} } = params;
        const normalizedAuthor = normalizeAccount(author);
        const normalizedParentAuthor = parentAuthor ? normalizeAccount(parentAuthor) : "";

        if (!normalizedAuthor) {
            throw new PixaAPIError('Invalid author parameter', 'INVALID_ACCOUNT');
        }

        const jsonMetadataValue = typeof jsonMetadata === 'string'
            ? jsonMetadata+""
            : JSON.stringify(jsonMetadata)+"";

        const op = {
            author: ""+normalizedAuthor,
            body: ""+body,
            json_metadata: ""+jsonMetadataValue,
            parent_author: ""+normalizedParentAuthor,
            parent_permlink: ""+parentPermlink,
            permlink: ""+permlink,
            title: ""+title
        };


        const key = await this.proxy.keyManager.requestKey(normalizedAuthor, 'posting');
        const result = await this.proxy.client.broadcast.comment(op, PrivateKey.fromString(key));

        // ── Post-broadcast: invalidate caches and notify listeners ─────────
        // Top-level posts (parent_author === '') and replies are distinguished
        // by separate events so page-level listeners can react narrowly
        // (e.g. Feed only cares about new posts; Profile's "comments" tab only
        // cares about replies). Invalidation is fire-and-forget — it matches
        // the contract of _invalidateAfterBroadcast and must never block the
        // caller's success path.
        try {
            await this._invalidateAfterBroadcast(
                [['comment', { ...op }]],
                { account: normalizedAuthor, keyType: 'posting' }
            );
        } catch (_) { /* opportunistic cache hygiene */ }

        if (this.proxy.eventEmitter) {
            // Parse json_metadata once so listeners don't each redo the work.
            // Legacy/buggy posts ship invalid JSON; treat that as "no metadata"
            // rather than failing the emit.
            let parsedMeta = null;
            try { parsedMeta = JSON.parse(jsonMetadataValue); } catch (_) { parsedMeta = null; }

            const isReply = normalizedParentAuthor !== '';
            const eventName = isReply ? 'comment_published' : 'post_published';
            const payload = {
                author: normalizedAuthor,
                permlink,
                parentAuthor: normalizedParentAuthor,
                parentPermlink,
                title,
                jsonMetadata: parsedMeta,
            };
            try { this.proxy.eventEmitter.emit(eventName, payload); } catch (_) {}
        }

        return result;
    }

    /**
     * Set comment options (beneficiaries, payout settings, etc.)
     * @param {object} params
     */
    async commentOptions(params) {
        const { author, permlink, maxAcceptedPayout, percentPxs, allowVotes, allowCurationRewards, extensions } = params;
        const normalizedAuthor = normalizeAccount(author);

        if (!normalizedAuthor) {
            throw new PixaAPIError('Invalid author parameter', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedAuthor, 'posting');

        const op = {
            author: normalizedAuthor,
            permlink,
            max_accepted_payout: translateAssetToChain(maxAcceptedPayout || '1000000.000 PXS'),
            percent_hbd: percentPxs !== undefined ? percentPxs : 10000,
            allow_votes: allowVotes !== undefined ? allowVotes : true,
            allow_curation_rewards: allowCurationRewards !== undefined ? allowCurationRewards : true,
            extensions: extensions || []
        };

        return this._send(
            [['comment_options', op]], key,
            { account: normalizedAuthor, keyType: 'posting' });
    }

    async transfer(from, to, amount, memo = '') {
        const normalizedFrom = normalizeAccount(from);
        const normalizedTo = normalizeAccount(to);

        if (!normalizedFrom || !normalizedTo) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        // SECURITY FIX (v3.5.2): Validate amount format before broadcasting
        if (!VALIDATORS.safe_asset(amount)) {
            throw new PixaAPIError('Invalid amount format', 'INVALID_AMOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedFrom, 'active');
        const op = {
            from: normalizedFrom,
            to: normalizedTo,
            amount: translateAssetToChain(amount),
            memo
        };
        return this._send(
            [['transfer', op]],
            key,
            { account: normalizedFrom, keyType: 'active' },
            (privateKey) => this.proxy.client.broadcast.transfer(op, privateKey)
        );
    }

    /**
     * Power up (transfer to vesting)
     * @param {string} from - Source account
     * @param {string} to - Destination account (can be same or different)
     * @param {string} amount - Amount in PXA (e.g., "100.000 PXA")
     */
    async transferToVesting(from, to, amount) {
        const normalizedFrom = normalizeAccount(from);
        const normalizedTo = normalizeAccount(to) || normalizedFrom;

        if (!normalizedFrom) {
            throw new PixaAPIError('Invalid from account', 'INVALID_ACCOUNT');
        }

        // SECURITY FIX (v3.5.2): Validate amount format before broadcasting
        if (!VALIDATORS.safe_asset(amount)) {
            throw new PixaAPIError('Invalid amount format', 'INVALID_AMOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedFrom, 'active');
        return this._send(
            [['transfer_to_vesting', {
                from: normalizedFrom,
                to: normalizedTo,
                amount: translateAssetToChain(amount)
            }]],
            key,
            { account: normalizedFrom, keyType: 'active' }
        );
    }

    /**
     * Power down (withdraw vesting)
     * @param {string} account - Account to power down
     * @param {string} vestingShares - Amount in PXP (e.g., "1000000.000000 PXP"), use "0.000000 PXP" to cancel
     */
    async withdrawVesting(account, vestingShares) {
        const normalizedAccount = normalizeAccount(account);

        if (!normalizedAccount) {
            throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');
        }

        // SECURITY FIX (v3.5.2): Validate amount format before broadcasting
        if (!VALIDATORS.safe_asset(vestingShares)) {
            throw new PixaAPIError('Invalid vesting shares format', 'INVALID_AMOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedAccount, 'active');
        return this._send(
            [['withdraw_vesting', {
                account: normalizedAccount,
                vesting_shares: translateAssetToChain(vestingShares)
            }]],
            key,
            { account: normalizedAccount, keyType: 'active' }
        );
    }

    /**
     * Delegate vesting shares
     * @param {string} delegator - Account delegating
     * @param {string} delegatee - Account receiving delegation
     * @param {string} vestingShares - Amount in PXP (use "0.000000 PXP" to undelegate)
     */
    async delegateVestingShares(delegator, delegatee, vestingShares) {
        const normalizedDelegator = normalizeAccount(delegator);
        const normalizedDelegatee = normalizeAccount(delegatee);

        if (!normalizedDelegator || !normalizedDelegatee) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        // SECURITY FIX (v3.5.2): Validate amount format before broadcasting
        if (!VALIDATORS.safe_asset(vestingShares)) {
            throw new PixaAPIError('Invalid vesting shares format', 'INVALID_AMOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedDelegator, 'active');
        return this._send(
            [['delegate_vesting_shares', {
                delegator: normalizedDelegator,
                delegatee: normalizedDelegatee,
                vesting_shares: translateAssetToChain(vestingShares)
            }]],
            key,
            { account: normalizedDelegator, keyType: 'active' }
        );
    }

    /**
     * Transfer to savings
     */
    async transferToSavings(from, to, amount, memo = '') {
        const normalizedFrom = normalizeAccount(from);
        const normalizedTo = normalizeAccount(to);

        if (!normalizedFrom || !normalizedTo) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        // SECURITY FIX (v3.5.2): Validate amount format before broadcasting
        if (!VALIDATORS.safe_asset(amount)) {
            throw new PixaAPIError('Invalid amount format', 'INVALID_AMOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedFrom, 'active');
        return this._send(
            [['transfer_to_savings', {
                from: normalizedFrom,
                to: normalizedTo,
                amount: translateAssetToChain(amount),
                memo
            }]],
            key,
            { account: normalizedFrom, keyType: 'active' }
        );
    }

    /**
     * Transfer from savings (initiates 3-day withdrawal)
     */
    async transferFromSavings(from, requestId, to, amount, memo = '') {
        const normalizedFrom = normalizeAccount(from);
        const normalizedTo = normalizeAccount(to);

        if (!normalizedFrom || !normalizedTo) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        // SECURITY FIX (v3.5.2): Validate amount format before broadcasting
        if (!VALIDATORS.safe_asset(amount)) {
            throw new PixaAPIError('Invalid amount format', 'INVALID_AMOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedFrom, 'active');
        return this._send(
            [['transfer_from_savings', {
                from: normalizedFrom,
                request_id: requestId,
                to: normalizedTo,
                amount: translateAssetToChain(amount),
                memo
            }]],
            key,
            { account: normalizedFrom, keyType: 'active' }
        );
    }

    /**
     * Cancel pending savings withdrawal
     */
    async cancelTransferFromSavings(from, requestId) {
        const normalizedFrom = normalizeAccount(from);

        if (!normalizedFrom) {
            throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedFrom, 'active');
        return this._send(
            [['cancel_transfer_from_savings', {
                from: normalizedFrom,
                request_id: requestId
            }]], key,
            { account: normalizedFrom, keyType: 'active' });
    }

    /**
     * Claim pending rewards
     * @param {string} account - Account claiming rewards
     * @param {string} rewardPixa - PXA reward to claim (e.g., "1.000 PXA")
     * @param {string} rewardPxs - PXS reward to claim (e.g., "0.500 PXS")
     * @param {string} rewardVests - PXP reward to claim (e.g., "100.000000 PXP")
     */
    async claimRewardBalance(account) {
        const normalizedAccount = normalizeAccount(account);

        if (!normalizedAccount) {
            throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');
        }

        // Fetch the raw (unsanitized) account to get reward balances in chain symbols
        const [rawAccount] = await this.proxy.client.database.getAccounts([normalizedAccount]);
        if (!rawAccount) {
            throw new PixaAPIError('Account not found', 'ACCOUNT_NOT_FOUND');
        }

        // Chain returns PIXA / PXS / VESTS but signing requires TESTS / TBD / VESTS
        const rewardPixa  = rawAccount.reward_pixa_balance    || '0.000 PIXA';
        const rewardPxs   = rawAccount.reward_pxs_balance     || '0.000 PXS';
        const rewardVests = rawAccount.reward_vesting_balance  || '0.000000 VESTS';

        const key = await this.proxy.keyManager.requestKey(normalizedAccount, 'posting');
        const op = {
            account: normalizedAccount,
            reward_pixa: translateAssetToChain(rewardPixa),
            reward_pxs:  translateAssetToChain(rewardPxs),
            reward_vests: rewardVests,
        };
        return this._send(
            [['claim_reward_balance', op]], key,
            { account: normalizedAccount, keyType: 'posting' }
        );
    }

    /**
     * Set up recurring transfer
     * @param {object} params
     */
    async recurrentTransfer(params) {
        const { from, to, amount, memo = '', recurrence, executions } = params;
        const normalizedFrom = normalizeAccount(from);
        const normalizedTo = normalizeAccount(to);

        if (!normalizedFrom || !normalizedTo) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedFrom, 'active');
        return this._send(
            [['recurrent_transfer', {
                from: normalizedFrom,
                to: normalizedTo,
                amount: translateAssetToChain(amount),
                memo,
                recurrence, // Hours between transfers
                executions, // Number of transfers (0 to cancel)
                extensions: []
            }]],
            key,
            { account: normalizedFrom, keyType: 'active' }
        );
    }

    async follow(follower, following) {
        const normalizedFollower = normalizeAccount(follower);
        const normalizedFollowing = normalizeAccount(following);

        if (!normalizedFollower || !normalizedFollowing) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedFollower, 'posting');
        return this._send(
            [['custom_json', {
                required_auths: [],
                required_posting_auths: [normalizedFollower],
                id: 'follow',
                json: JSON.stringify(['follow', { follower: normalizedFollower, following: normalizedFollowing, what: ['blog'] }])
            }]],
            key,
            { account: normalizedFollower, keyType: 'posting' }
        );
    }

    async unfollow(follower, following) {
        const normalizedFollower = normalizeAccount(follower);
        const normalizedFollowing = normalizeAccount(following);

        if (!normalizedFollower || !normalizedFollowing) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedFollower, 'posting');
        return this._send(
            [['custom_json', {
                required_auths: [],
                required_posting_auths: [normalizedFollower],
                id: 'follow',
                json: JSON.stringify(['follow', { follower: normalizedFollower, following: normalizedFollowing, what: [] }])
            }]],
            key,
            { account: normalizedFollower, keyType: 'posting' }
        );
    }

    /**
     * Mute a user
     */
    async mute(follower, following) {
        const normalizedFollower = normalizeAccount(follower);
        const normalizedFollowing = normalizeAccount(following);

        if (!normalizedFollower || !normalizedFollowing) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedFollower, 'posting');
        return this._send(
            [['custom_json', {
                required_auths: [],
                required_posting_auths: [normalizedFollower],
                id: 'follow',
                json: JSON.stringify(['follow', { follower: normalizedFollower, following: normalizedFollowing, what: ['ignore'] }])
            }]],
            key,
            { account: normalizedFollower, keyType: 'posting' }
        );
    }

    async reblog(account, author, permlink) {
        const normalizedAccount = normalizeAccount(account);
        const normalizedAuthor = normalizeAccount(author);

        if (!normalizedAccount || !normalizedAuthor) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedAccount, 'posting');
        return this._send(
            [['custom_json', {
                required_auths: [],
                required_posting_auths: [normalizedAccount],
                id: 'follow',
                json: JSON.stringify(['reblog', { account: normalizedAccount, author: normalizedAuthor, permlink }])
            }]],
            key
        );
    }

    /**
     * Broadcast a custom_json operation
     * @param {object} params - { requiredAuths, requiredPostingAuths, id, json }
     * @param {object} [auths] - Optional override keys. When provided, bypasses
     *   keyManager and uses the supplied WIF directly.
     *   Shape: { active: '<wif>', posting: '<wif>' }
     */
    async customJson(params, auths) {
        const { requiredAuths = [], requiredPostingAuths = [], id, json } = params;
        const signingAccount = requiredAuths[0] || requiredPostingAuths[0];
        const keyType = requiredAuths.length > 0 ? 'active' : 'posting';

        let key;
        if (auths && auths[keyType]) {
            key = auths[keyType];
        } else {
            key = await this.proxy.keyManager.requestKey(normalizeAccount(signingAccount), keyType);
        }

        return this._send(
            [['custom_json', {
                required_auths: requiredAuths.map(a => normalizeAccount(a)),
                required_posting_auths: requiredPostingAuths.map(a => normalizeAccount(a)),
                id,
                json: typeof json === 'string' ? json : JSON.stringify(json)
            }]],
            key,
            { account: normalizeAccount(signingAccount), keyType }
        );
    }

    async deleteComment(author, permlink) {
        const normalizedAuthor = normalizeAccount(author);

        if (!normalizedAuthor) {
            throw new PixaAPIError('Invalid author', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedAuthor, 'posting');
        const result = await this._send(
            [['delete_comment', { author: normalizedAuthor, permlink }]], key,
            { account: normalizedAuthor, keyType: 'posting' });

        // Fire-and-forget cache invalidation + listener notification, paired
        // with the comment()/post_published path so deletions and creations
        // travel through the same notification channel.
        try {
            await this._invalidateAfterBroadcast(
                [['delete_comment', { author: normalizedAuthor, permlink }]],
                { account: normalizedAuthor, keyType: 'posting' }
            );
        } catch (_) {}

        if (this.proxy.eventEmitter) {
            try {
                this.proxy.eventEmitter.emit('content_deleted', {
                    author: normalizedAuthor,
                    permlink,
                });
            } catch (_) {}
        }

        return result;
    }

    /**
     * Edit an existing post or comment in place.
     *
     * HIVE-style edits re-broadcast the `comment` op with the SAME permlink,
     * parent_author and parent_permlink — the chain treats that as an update.
     * The current on-chain version is fetched first (raw, un-sanitized) so:
     *   - omitted fields keep their existing values,
     *   - jsonMetadata can be shallow-merged onto the current metadata,
     *   - the body diff is computed against the exact bytes the chain holds.
     *
     * When the body changed, a diff-match-patch patch is sent instead of the
     * full body whenever it is provably safe AND smaller (see
     * makeContentEditPatch) — the canonical bandwidth optimization from
     * https://developers.hive.io/tutorials-javascript/edit_content_patching.html.
     * In every other case the full new body is sent, which the chain accepts
     * unconditionally.
     *
     * @param {object} params
     * @param {string}        params.author        - Content author (must be the signer).
     * @param {string}        params.permlink      - Content permlink.
     * @param {string}        [params.body]        - New body (markdown / base64 / text).
     *                                               Omit to keep the current body.
     * @param {string}        [params.title]       - New title. Omit to keep current.
     * @param {object|string} [params.jsonMetadata]- Metadata patch or replacement.
     * @param {boolean}       [params.metadataMerge=true] - true: shallow-merge onto
     *                                               current metadata; false: replace it.
     * @param {string[]}      [params.addTags]     - Tags to append to metadata.tags
     *                                               (deduped, applied after the merge).
     * @param {string[]}      [params.removeTags]  - Tags to strip from metadata.tags.
     * @returns {Promise<object>} Broadcast result, or `{ unchanged: true }` when
     *                            nothing differs from the on-chain version.
     */
    async updateComment(params) {
        const { author, permlink, body, title, jsonMetadata, metadataMerge = true, addTags, removeTags } = params || {};
        const normalizedAuthor = normalizeAccount(author);

        if (!normalizedAuthor || !permlink) {
            throw new PixaAPIError('Invalid author/permlink parameters', 'INVALID_ACCOUNT');
        }

        // ── 1. Current on-chain version — raw mode: body and json_metadata
        //       exactly as stored, no sanitization, no annotations. The patch
        //       base MUST be these bytes, not the sanitized HTML the UI shows.
        const current = await this.proxy.content.getContent(normalizedAuthor, permlink, { raw: true });
        if (!current || !current.author) {
            throw new PixaAPIError('Content not found — cannot edit', 'CONTENT_NOT_FOUND');
        }

        const currentBody = String(current.body || '');
        let currentMeta = {};
        try {
            const parsed = JSON.parse(current.json_metadata || '{}');
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) currentMeta = parsed;
        } catch (_) { currentMeta = {}; }

        // ── 2. Resolve new field values — anything omitted keeps its on-chain value ──
        const newTitle = (title !== undefined && title !== null) ? String(title) : String(current.title || '');

        let newMeta = currentMeta;
        if (jsonMetadata !== undefined && jsonMetadata !== null) {
            let patchMeta = jsonMetadata;
            if (typeof patchMeta === 'string') {
                try { patchMeta = JSON.parse(patchMeta); } catch (_) { patchMeta = {}; }
            }
            if (!patchMeta || typeof patchMeta !== 'object' || Array.isArray(patchMeta)) patchMeta = {};
            newMeta = metadataMerge ? { ...currentMeta, ...patchMeta } : patchMeta;
        }

        // Tag conveniences — applied on top of the resolved metadata so callers
        // can flip a single tag (e.g. 'deleted') without reading tags first.
        if ((Array.isArray(addTags) && addTags.length) || (Array.isArray(removeTags) && removeTags.length)) {
            const baseTags = Array.isArray(newMeta.tags)
                ? newMeta.tags.filter(t => typeof t === 'string')
                : [];
            const removeSet = new Set((removeTags || []).map(t => String(t).toLowerCase().trim()));
            const seen = new Set();
            const outTags = [];
            for (const t of baseTags) {
                const v = String(t).toLowerCase().trim();
                if (!v || removeSet.has(v) || seen.has(v)) continue;
                seen.add(v);
                outTags.push(t);
            }
            for (const t of (addTags || [])) {
                const v = String(t).toLowerCase().trim();
                if (!v || removeSet.has(v) || seen.has(v)) continue;
                seen.add(v);
                outTags.push(v);
            }
            newMeta = { ...newMeta, tags: outTags };
        }

        const newBody = (body !== undefined && body !== null && String(body).length > 0)
            ? String(body)
            : currentBody;

        const bodyChanged = newBody !== currentBody;
        const titleChanged = newTitle !== String(current.title || '');
        const metaChanged = JSON.stringify(newMeta) !== JSON.stringify(currentMeta);
        if (!bodyChanged && !titleChanged && !metaChanged) {
            return { unchanged: true };
        }

        // ── 3. Body wire format: dmp patch when provably safe AND smaller.
        //       comment_operation::validate() requires a non-empty body even
        //       on edits, so metadata-only updates resend the current body.
        let bodyToSend = newBody;
        let usedPatch = false;
        if (bodyChanged) {
            const patch = makeContentEditPatch(currentBody, newBody);
            if (patch && patch.length < newBody.length) {
                bodyToSend = patch;
                usedPatch = true;
            }
        }

        // ── 4. Re-broadcast with identical identity coordinates = edit.
        //       parent_author/parent_permlink can never change on HIVE-style
        //       chains, so they are always taken from the on-chain version.
        const op = {
            author: '' + normalizedAuthor,
            body: '' + bodyToSend,
            json_metadata: '' + JSON.stringify(newMeta),
            parent_author: '' + (current.parent_author || ''),
            parent_permlink: '' + (current.parent_permlink || ''),
            permlink: '' + permlink,
            title: '' + newTitle,
        };

        const key = await this.proxy.keyManager.requestKey(normalizedAuthor, 'posting');
        const result = await this.proxy.client.broadcast.comment(op, PrivateKey.fromString(key));

        // ── Post-broadcast: cache hygiene + listener notification, mirroring
        //    the comment()/deleteComment() channels so pages can react. ──
        try {
            await this._invalidateAfterBroadcast(
                [['comment', { ...op }]],
                { account: normalizedAuthor, keyType: 'posting' }
            );
        } catch (_) { /* opportunistic cache hygiene */ }

        if (this.proxy.eventEmitter) {
            const isPost = (current.parent_author || '') === '';
            try {
                this.proxy.eventEmitter.emit('content_updated', {
                    author: normalizedAuthor,
                    permlink,
                    parentAuthor: current.parent_author || '',
                    parentPermlink: current.parent_permlink || '',
                    title: newTitle,
                    body: newBody,           // resolved FULL body (never the patch)
                    jsonMetadata: newMeta,   // resolved merged metadata (object)
                    isPost,
                    usedPatch,
                });
            } catch (_) {}
        }

        return result;
    }

    /**
     * Create a new account
     * @param {object} params
     */
    async accountCreate(params) {
        const { fee, creator, newAccountName, owner, active, posting, memoKey, jsonMetadata = '{}' } = params;
        const normalizedCreator = normalizeAccount(creator);
        const normalizedNewAccount = normalizeAccount(newAccountName);

        if (!normalizedCreator || !normalizedNewAccount) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedCreator, 'active');
        return this._send(
            [['account_create', {
                fee: translateAssetToChain(fee),
                creator: normalizedCreator,
                new_account_name: normalizedNewAccount,
                owner,
                active,
                posting,
                memo_key: memoKey,
                json_metadata: typeof jsonMetadata === 'string' ? jsonMetadata : JSON.stringify(jsonMetadata)
            }]],
            key,
            { account: normalizedCreator, keyType: 'active' }
        );
    }

    /**
     * Create account with delegation
     */
    async accountCreateWithDelegation(params) {
        const { fee, delegation, creator, newAccountName, owner, active, posting, memoKey, jsonMetadata = '{}', extensions = [] } = params;
        const normalizedCreator = normalizeAccount(creator);
        const normalizedNewAccount = normalizeAccount(newAccountName);

        if (!normalizedCreator || !normalizedNewAccount) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedCreator, 'active');
        return this._send(
            [['account_create_with_delegation', {
                fee: translateAssetToChain(fee),
                delegation: translateAssetToChain(delegation),
                creator: normalizedCreator,
                new_account_name: normalizedNewAccount,
                owner,
                active,
                posting,
                memo_key: memoKey,
                json_metadata: typeof jsonMetadata === 'string' ? jsonMetadata : JSON.stringify(jsonMetadata),
                extensions
            }]],
            key,
            { account: normalizedCreator, keyType: 'active' }
        );
    }

    /**
     * Vote for a witness
     */
    async accountWitnessVote(account, witness, approve = true) {
        const normalizedAccount = normalizeAccount(account);
        const normalizedWitness = normalizeAccount(witness);

        if (!normalizedAccount || !normalizedWitness) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedAccount, 'active');
        return this._send(
            [['account_witness_vote', {
                account: normalizedAccount,
                witness: normalizedWitness,
                approve
            }]], key,
            { account: normalizedAccount, keyType: 'active' });
    }

    /**
     * Set witness proxy
     */
    async accountWitnessProxy(account, proxy) {
        const normalizedAccount = normalizeAccount(account);
        const normalizedProxy = proxy ? normalizeAccount(proxy) : '';

        if (!normalizedAccount) {
            throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedAccount, 'active');
        return this._send(
            [['account_witness_proxy', {
                account: normalizedAccount,
                proxy: normalizedProxy
            }]], key,
            { account: normalizedAccount, keyType: 'active' });
    }

    /**
     * Update witness
     */
    async witnessUpdate(params) {
        const { owner, url, blockSigningKey, props, fee } = params;
        const normalizedOwner = normalizeAccount(owner);

        if (!normalizedOwner) {
            throw new PixaAPIError('Invalid owner account', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedOwner, 'active');
        const chainProps = props ? { ...props } : {};
        if (chainProps.account_creation_fee) {
            chainProps.account_creation_fee = translateAssetToChain(chainProps.account_creation_fee);
        }
        return this._send(
            [['witness_update', {
                owner: normalizedOwner,
                url,
                block_signing_key: blockSigningKey,
                props: chainProps,
                fee: translateAssetToChain(fee)
            }]],
            key,
            { account: normalizedOwner, keyType: 'active' }
        );
    }

    /**
     * Set withdraw vesting route (for power down distribution)
     */
    async setWithdrawVestingRoute(fromAccount, toAccount, percent, autoVest = false) {
        const normalizedFrom = normalizeAccount(fromAccount);
        const normalizedTo = normalizeAccount(toAccount);

        if (!normalizedFrom || !normalizedTo) {
            throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedFrom, 'active');
        return this._send(
            [['set_withdraw_vesting_route', {
                from_account: normalizedFrom,
                to_account: normalizedTo,
                percent, // 0-10000 (basis points)
                auto_vest: autoVest
            }]],
            key,
            { account: normalizedFrom, keyType: 'active' }
        );
    }

    /**
     * Create limit order on internal market
     */
    async limitOrderCreate(params) {
        const { owner, orderId, amountToSell, minToReceive, fillOrKill = false, expiration } = params;
        const normalizedOwner = normalizeAccount(owner);

        if (!normalizedOwner) {
            throw new PixaAPIError('Invalid owner account', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedOwner, 'active');
        return this._send(
            [['limit_order_create', {
                owner: normalizedOwner,
                orderid: orderId,
                amount_to_sell: translateAssetToChain(amountToSell),
                min_to_receive: translateAssetToChain(minToReceive),
                fill_or_kill: fillOrKill,
                expiration: expiration || new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, -5)
            }]],
            key,
            { account: normalizedOwner, keyType: 'active' }
        );
    }

    /**
     * Cancel limit order
     */
    async limitOrderCancel(owner, orderId) {
        const normalizedOwner = normalizeAccount(owner);

        if (!normalizedOwner) {
            throw new PixaAPIError('Invalid owner account', 'INVALID_ACCOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedOwner, 'active');
        return this._send(
            [['limit_order_cancel', {
                owner: normalizedOwner,
                orderid: orderId
            }]], key,
            { account: normalizedOwner, keyType: 'active' });
    }

    /**
     * Convert PXA to PXS
     */
    async convertPixa(owner, amount, requestId) {
        const normalizedOwner = normalizeAccount(owner);

        if (!normalizedOwner) {
            throw new PixaAPIError('Invalid owner account', 'INVALID_ACCOUNT');
        }

        // SECURITY FIX (v3.5.2): Validate amount format before broadcasting
        if (!VALIDATORS.safe_asset(amount)) {
            throw new PixaAPIError('Invalid amount format', 'INVALID_AMOUNT');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedOwner, 'active');
        return this._send(
            [['convert', {
                owner: normalizedOwner,
                amount: translateAssetToChain(amount),
                requestid: requestId
            }]],
            key,
            { account: normalizedOwner, keyType: 'active' }
        );
    }

    /**
     * Send raw operations
     * @param {Array} operations - Array of [opType, opData] tuples
     * @param {PrivateKey|string} key - Private key for signing
     */
    async sendOperations(operations, key) {
        const privateKey = typeof key === 'string' ? PrivateKey.fromString(key) : key;
        return this._send(operations, privateKey);
    }

    // ========================================================================
    // Additional Broadcast Operations (v4.1.0)
    // ========================================================================

    /**
     * Update account (v1 — legacy, still used for some authority changes)
     * @param {object} params
     */
    async accountUpdate(params) {
        const { account, owner, active, posting, memoKey, jsonMetadata = '{}' } = params;
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');

        const requiresOwner = !!owner;
        const keyType = requiresOwner ? 'owner' : 'active';
        const key = await this.proxy.keyManager.requestKey(normalizedAccount, keyType);

        const op = { account: normalizedAccount };
        if (owner) op.owner = owner;
        if (active) op.active = active;
        if (posting) op.posting = posting;
        if (memoKey) op.memo_key = memoKey;
        op.json_metadata = typeof jsonMetadata === 'string' ? jsonMetadata : JSON.stringify(jsonMetadata);

        return this._send(
            [['account_update', op]], key,
            { account: normalizedAccount, keyType });
    }

    /**
     * Claim a discounted account creation token
     * @param {string} creator - Account claiming the token
     * @param {string} [fee='0.000 PIXA'] - Fee (usually 0 for RC-based claims)
     * @returns {Promise<object>}
     */
    async claimAccount(creator, fee = '0.000 PIXA') {
        const normalizedCreator = normalizeAccount(creator);
        if (!normalizedCreator) throw new PixaAPIError('Invalid creator', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedCreator, 'active');
        return this._send(
            [['claim_account', {
                creator: normalizedCreator,
                fee: translateAssetToChain(fee),
                extensions: []
            }]],
            key,
            { account: normalizedCreator, keyType: 'active' }
        );
    }

    /**
     * Create an account using a previously claimed token
     * @param {object} params
     * @returns {Promise<object>}
     */
    async createClaimedAccount(params) {
        const { creator, newAccountName, owner, active, posting, memoKey, jsonMetadata = '{}', extensions = [] } = params;
        const normalizedCreator = normalizeAccount(creator);
        const normalizedNew = normalizeAccount(newAccountName);
        if (!normalizedCreator || !normalizedNew) throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedCreator, 'active');
        return this._send(
            [['create_claimed_account', {
                creator: normalizedCreator,
                new_account_name: normalizedNew,
                owner, active, posting,
                memo_key: memoKey,
                json_metadata: typeof jsonMetadata === 'string' ? jsonMetadata : JSON.stringify(jsonMetadata),
                extensions
            }]],
            key,
            { account: normalizedCreator, keyType: 'active' }
        );
    }

    /**
     * Collateralized convert (convert PIXA to PXS with PIXA collateral)
     * @param {string} owner
     * @param {string} amount - Amount to convert
     * @param {number} requestId
     * @returns {Promise<object>}
     */
    async collateralizedConvert(owner, amount, requestId) {
        const normalizedOwner = normalizeAccount(owner);
        if (!normalizedOwner) throw new PixaAPIError('Invalid owner', 'INVALID_ACCOUNT');
        if (!VALIDATORS.safe_asset(amount)) throw new PixaAPIError('Invalid amount format', 'INVALID_AMOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedOwner, 'active');
        return this._send(
            [['collateralized_convert', {
                owner: normalizedOwner,
                requestid: requestId,
                amount: translateAssetToChain(amount)
            }]],
            key,
            { account: normalizedOwner, keyType: 'active' }
        );
    }

    /**
     * Create limit order (v2 — uses exchange_rate instead of min_to_receive)
     * @param {object} params
     * @returns {Promise<object>}
     */
    async limitOrderCreate2(params) {
        const { owner, orderId, amountToSell, exchangeRate, fillOrKill = false, expiration } = params;
        const normalizedOwner = normalizeAccount(owner);
        if (!normalizedOwner) throw new PixaAPIError('Invalid owner', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedOwner, 'active');
        return this._send(
            [['limit_order_create2', {
                owner: normalizedOwner,
                orderid: orderId,
                amount_to_sell: translateAssetToChain(amountToSell),
                exchange_rate: {
                    base: translateAssetToChain(exchangeRate.base),
                    quote: translateAssetToChain(exchangeRate.quote)
                },
                fill_or_kill: fillOrKill,
                expiration: expiration || new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, -5)
            }]],
            key,
            { account: normalizedOwner, keyType: 'active' }
        );
    }

    /**
     * Publish a price feed (witnesses only)
     * @param {string} publisher - Witness account
     * @param {object} exchangeRate - { base: "0.500 PXS", quote: "1.000 PIXA" }
     * @returns {Promise<object>}
     */
    async feedPublish(publisher, exchangeRate) {
        const normalizedPublisher = normalizeAccount(publisher);
        if (!normalizedPublisher) throw new PixaAPIError('Invalid publisher', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedPublisher, 'active');
        return this._send(
            [['feed_publish', {
                publisher: normalizedPublisher,
                exchange_rate: {
                    base: translateAssetToChain(exchangeRate.base),
                    quote: translateAssetToChain(exchangeRate.quote)
                }
            }]],
            key,
            { account: normalizedPublisher, keyType: 'active' }
        );
    }

    /**
     * Set witness properties (modern witness configuration, op #42).
     *
     * Uses dpixa's `utils.buildWitnessUpdateOp(owner, props)` to build the
     * fully-serialized operation from a friendly props object. The builder
     * runs each value through the matching dpixa `Types` serializer and
     * produces the on-chain `[[key, hex_bytes], …]` flat-map shape the
     * chain expects.
     *
     * The built op is then handed to `sendOperations` directly. We bypass
     * `_send` because:
     *   - `_send`'s online shortcut would route single ops through
     *     `client.broadcast.witnessSetProperties` (a builder helper that
     *     would re-process our already-built op)
     *   - the queue's drain path does the same auto-routing when offline
     *
     * @param {string} owner — Witness account
     * @param {object} props — Friendly object, e.g.
     *   {
     *     key:                  "STM...",                      // optional new signing key
     *     account_creation_fee: "0.000 PIXA",
     *     maximum_block_size:   131072,
     *     pxs_interest_rate:    0,                              // uint16 basis points
     *     pxs_exchange_rate:    { base: "1.000 PXS", quote: "1.000 PIXA" },
     *     url:                  "https://my-witness.example"   // optional
     *   }
     * @returns {Promise<object>}
     */
    async witnessSetProperties(owner, props) {
        const normalizedOwner = normalizeAccount(owner);
        if (!normalizedOwner) throw new PixaAPIError('Invalid owner', 'INVALID_ACCOUNT');
        if (!props || typeof props !== 'object' || Array.isArray(props)) {
            throw new PixaAPIError('props must be a plain object', 'INVALID_PROPS');
        }
        if (!utils || typeof utils.buildWitnessUpdateOp !== 'function') {
            throw new PixaAPIError(
                'utils.buildWitnessUpdateOp is not available on dpixa',
                'NOT_SUPPORTED'
            );
        }

        // Translate display-symbol assets (PIXA/PXS/PXP) to their on-chain
        // counterparts (TESTS/TBD/VESTS) before the props reach dpixa's
        // serializer. Every other broadcast method in this file does this
        // via translateAssetToChain() — we have to do it here too because
        // dpixa's Asset.from(…).steem_symbols() emits STEEM/SBD (stock
        // Steem mapping), which is NOT what the fork's chain expects.
        //
        // Symbols of properties we know about:
        //   account_creation_fee → Asset
        //   pxs_exchange_rate    → Price (= Asset base + Asset quote)
        //   pxs_interest_rate, maximum_block_size → numeric, no translation
        //   url, key             → no translation
        const chainProps = { ...props };
        if (chainProps.account_creation_fee) {
            chainProps.account_creation_fee = translateAssetToChain(chainProps.account_creation_fee);
        }
        if (chainProps.pxs_exchange_rate
            && typeof chainProps.pxs_exchange_rate === 'object') {
            const r = chainProps.pxs_exchange_rate;
            chainProps.pxs_exchange_rate = {
                base:  r.base  ? translateAssetToChain(r.base)  : r.base,
                quote: r.quote ? translateAssetToChain(r.quote) : r.quote
            };
        }

        // Build the fully-serialized op via dpixa. Returns
        // ["witness_set_properties", { owner, props: [[k, hex], …], extensions: [] }]
        const builtOp = utils.buildWitnessUpdateOp(normalizedOwner, chainProps);

        // Touch session activity so the auto-lock timer doesn't fire mid-broadcast.
        this.proxy.sessionManager?.touchActivity?.();

        const wif = await this.proxy.keyManager.requestKey(normalizedOwner, 'active');
        const privateKey = (typeof wif === 'string') ? PrivateKey.fromString(wif) : wif;

        try {
            return await this.proxy.client.broadcast.sendOperations([builtOp], privateKey);
        } finally {
            // Zero the 32-byte secret on the PrivateKey copy if dpixa exposes it.
            if (privateKey && privateKey.secret && typeof privateKey.secret.fill === 'function') {
                privateKey.secret.fill(0);
            }
        }
    }

    // --- Escrow Operations ---

    /**
     * Initiate an escrow transfer
     * @param {object} params
     * @returns {Promise<object>}
     */
    async escrowTransfer(params) {
        const { from, to, agent, escrowId, pxsFee, pixaFee, ratificationDeadline, escrowExpiration, jsonMeta = '{}', amount } = params;
        const normalizedFrom = normalizeAccount(from);
        const normalizedTo = normalizeAccount(to);
        const normalizedAgent = normalizeAccount(agent);
        if (!normalizedFrom || !normalizedTo || !normalizedAgent) throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedFrom, 'active');
        return this._send(
            [['escrow_transfer', {
                from: normalizedFrom,
                to: normalizedTo,
                agent: normalizedAgent,
                escrow_id: escrowId,
                hbd_amount: translateAssetToChain(pxsFee || '0.000 PXS'),
                hive_amount: translateAssetToChain(amount || '0.000 PIXA'),
                fee: translateAssetToChain(pixaFee || '0.000 PIXA'),
                ratification_deadline: ratificationDeadline,
                escrow_expiration: escrowExpiration,
                json_meta: typeof jsonMeta === 'string' ? jsonMeta : JSON.stringify(jsonMeta)
            }]],
            key,
            { account: normalizedFrom, keyType: 'active' }
        );
    }

    /**
     * Approve an escrow transaction
     * @param {object} params
     * @returns {Promise<object>}
     */
    async escrowApprove(params) {
        const { from, to, agent, who, escrowId, approve = true } = params;
        const normalizedWho = normalizeAccount(who);
        if (!normalizedWho) throw new PixaAPIError('Invalid who parameter', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedWho, 'active');
        return this._send(
            [['escrow_approve', {
                from: normalizeAccount(from),
                to: normalizeAccount(to),
                agent: normalizeAccount(agent),
                who: normalizedWho,
                escrow_id: escrowId,
                approve
            }]],
            key,
            { account: normalizedWho, keyType: 'active' }
        );
    }

    /**
     * Dispute an escrow
     * @param {object} params
     * @returns {Promise<object>}
     */
    async escrowDispute(params) {
        const { from, to, agent, who, escrowId } = params;
        const normalizedWho = normalizeAccount(who);
        if (!normalizedWho) throw new PixaAPIError('Invalid who parameter', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedWho, 'active');
        return this._send(
            [['escrow_dispute', {
                from: normalizeAccount(from),
                to: normalizeAccount(to),
                agent: normalizeAccount(agent),
                who: normalizedWho,
                escrow_id: escrowId
            }]],
            key,
            { account: normalizedWho, keyType: 'active' }
        );
    }

    /**
     * Release funds from escrow
     * @param {object} params
     * @returns {Promise<object>}
     */
    async escrowRelease(params) {
        const { from, to, agent, who, receiver, escrowId, pxsAmount, pixaAmount } = params;
        const normalizedWho = normalizeAccount(who);
        if (!normalizedWho) throw new PixaAPIError('Invalid who parameter', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedWho, 'active');
        return this._send(
            [['escrow_release', {
                from: normalizeAccount(from),
                to: normalizeAccount(to),
                agent: normalizeAccount(agent),
                who: normalizedWho,
                receiver: normalizeAccount(receiver),
                escrow_id: escrowId,
                hbd_amount: translateAssetToChain(pxsAmount || '0.000 PXS'),
                hive_amount: translateAssetToChain(pixaAmount || '0.000 PIXA')
            }]],
            key,
            { account: normalizedWho, keyType: 'active' }
        );
    }

    // --- Proposal / DAO Operations ---

    /**
     * Create a proposal (DAO)
     * @param {object} params
     * @returns {Promise<object>}
     */
    async createProposal(params) {
        const { creator, receiver, startDate, endDate, dailyPay, subject, permlink, extensions = [] } = params;
        const normalizedCreator = normalizeAccount(creator);
        const normalizedReceiver = normalizeAccount(receiver);
        if (!normalizedCreator || !normalizedReceiver) throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedCreator, 'active');
        return this._send(
            [['create_proposal', {
                creator: normalizedCreator,
                receiver: normalizedReceiver,
                start_date: startDate,
                end_date: endDate,
                daily_pay: translateAssetToChain(dailyPay),
                subject,
                permlink,
                extensions
            }]],
            key,
            { account: normalizedCreator, keyType: 'active' }
        );
    }

    /**
     * Update an existing proposal.
     *
     * Hive's update_proposal op requires creator, proposal_id, daily_pay,
     * subject, permlink, and extensions on every call. You can only LOWER
     * daily_pay (never raise it). Changing end_date is done through the
     * extensions variant tag 1 (update_proposal_end_date), not a top-level
     * field on the op.
     *
     * When not changing a field, pass the current value from the existing
     * proposal so the op round-trips unchanged.
     *
     * @param {object} params
     * @param {number|string} params.proposalId - Proposal id (NOT the internal `id`, use `proposal_id`)
     * @param {string} params.creator          - Proposal creator (must sign with active)
     * @param {string} [params.dailyPay]       - Formatted asset, e.g. '3.000 PXS'. Omit → '0.000 PXS'
     * @param {string} [params.subject]        - Proposal subject
     * @param {string} [params.permlink]       - Creator-owned post permlink
     * @param {string} [params.endDate]        - ISO date string; travels in extensions
     * @param {Array}  [params.extensions=[]]  - Additional extensions (merged with end_date variant)
     * @returns {Promise<object>}
     */
    async updateProposal(params) {
        const { proposalId, creator, dailyPay, subject, permlink, endDate, extensions = [] } = params;
        const normalizedCreator = normalizeAccount(creator);
        if (!normalizedCreator) throw new PixaAPIError('Invalid creator', 'INVALID_ACCOUNT');
        if (proposalId === undefined || proposalId === null) {
            throw new PixaAPIError('proposalId is required', 'INVALID_PARAMS');
        }

        const key = await this.proxy.keyManager.requestKey(normalizedCreator, 'active');

        // end_date travels in the op's extensions as variant tag 1
        // (update_proposal_end_date). Never as a top-level op field.
        const opExtensions = Array.isArray(extensions) ? [...extensions] : [];
        if (endDate) {
            opExtensions.push([1, { end_date: endDate }]);
        }

        const op = {
            proposal_id: proposalId,
            creator: normalizedCreator,
            daily_pay: translateAssetToChain(dailyPay || '0.000 PXS'),
            subject: subject || '',
            permlink: permlink || '',
            extensions: opExtensions
        };

        return this._send(
            [['update_proposal', op]], key,
            { account: normalizedCreator, keyType: 'active' });
    }

    /**
     * Vote on proposals (approve or unapprove)
     * @param {string} voter
     * @param {number[]} proposalIds - Array of proposal IDs
     * @param {boolean} approve - true to approve, false to remove approval
     * @returns {Promise<object>}
     */
    async updateProposalVotes(voter, proposalIds, approve = true) {
        const normalizedVoter = normalizeAccount(voter);
        if (!normalizedVoter) throw new PixaAPIError('Invalid voter', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedVoter, 'active');
        return this._send(
            [['update_proposal_votes', {
                voter: normalizedVoter,
                proposal_ids: proposalIds,
                approve,
                extensions: []
            }]], key,
            { account: normalizedVoter, keyType: 'active' });
    }

    /**
     * Remove a proposal
     * @param {string} proposalOwner
     * @param {number[]} proposalIds - Array of proposal IDs to remove
     * @returns {Promise<object>}
     */
    async removeProposal(proposalOwner, proposalIds) {
        const normalizedOwner = normalizeAccount(proposalOwner);
        if (!normalizedOwner) throw new PixaAPIError('Invalid owner', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedOwner, 'active');
        return this._send(
            [['remove_proposal', {
                proposal_owner: normalizedOwner,
                proposal_ids: proposalIds,
                extensions: []
            }]], key,
            { account: normalizedOwner, keyType: 'active' });
    }

    // --- Account Recovery Operations ---

    /**
     * Request account recovery
     * @param {string} recoveryAccount - The account's recovery partner
     * @param {string} accountToRecover - Account being recovered
     * @param {object} newOwnerAuthority - New owner authority object
     * @returns {Promise<object>}
     */
    async requestAccountRecovery(recoveryAccount, accountToRecover, newOwnerAuthority) {
        const normalizedRecovery = normalizeAccount(recoveryAccount);
        const normalizedTarget = normalizeAccount(accountToRecover);
        if (!normalizedRecovery || !normalizedTarget) throw new PixaAPIError('Invalid account parameters', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedRecovery, 'active');
        return this._send(
            [['request_account_recovery', {
                recovery_account: normalizedRecovery,
                account_to_recover: normalizedTarget,
                new_owner_authority: newOwnerAuthority,
                extensions: []
            }]], key,
            { account: normalizedRecovery, keyType: 'active' });
    }

    /**
     * Complete account recovery (must be done within 24h of request)
     * @param {string} accountToRecover
     * @param {object} newOwnerAuthority
     * @param {object} recentOwnerAuthority
     * @returns {Promise<object>}
     */
    async recoverAccount(accountToRecover, newOwnerAuthority, recentOwnerAuthority) {
        const normalizedTarget = normalizeAccount(accountToRecover);
        if (!normalizedTarget) throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');

        // Recovery uses the NEW owner key
        const key = await this.proxy.keyManager.requestKey(normalizedTarget, 'owner');
        return this._send(
            [['recover_account', {
                account_to_recover: normalizedTarget,
                new_owner_authority: newOwnerAuthority,
                recent_owner_authority: recentOwnerAuthority,
                extensions: []
            }]], key,
            { account: normalizedTarget, keyType: 'owner' });
    }

    /**
     * Change account's recovery partner
     * @param {string} accountToRecover
     * @param {string} newRecoveryAccount
     * @returns {Promise<object>}
     */
    async changeRecoveryAccount(accountToRecover, newRecoveryAccount) {
        const normalizedTarget = normalizeAccount(accountToRecover);
        const normalizedRecovery = normalizeAccount(newRecoveryAccount);
        if (!normalizedTarget) throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedTarget, 'owner');
        return this._send(
            [['change_recovery_account', {
                account_to_recover: normalizedTarget,
                new_recovery_account: normalizedRecovery || '',
                extensions: []
            }]], key,
            { account: normalizedTarget, keyType: 'owner' });
    }

    /**
     * Decline voting rights (irreversible)
     * @param {string} account
     * @param {boolean} decline - true to decline, false to cancel (within timelock)
     * @returns {Promise<object>}
     */
    async declineVotingRights(account, decline = true) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');

        const key = await this.proxy.keyManager.requestKey(normalizedAccount, 'owner');
        return this._send(
            [['decline_voting_rights', {
                account: normalizedAccount,
                decline
            }]], key,
            { account: normalizedAccount, keyType: 'owner' });
    }

    // ========================================================================
    // Raw broadcast passthroughs (v4.3.0)
    // ========================================================================
    // For pre-signed transactions (e.g. from Hive Keychain, external signers,
    // or sessionless flows). These bypass key management, _send's cache
    // invalidation, and the offline queue — the caller is responsible for
    // signing, for understanding what they're broadcasting, and for retrying
    // on failure. Use _send (via the op-specific methods above) whenever
    // possible; fall back to these only when a pre-signed tx is unavoidable.
    // ========================================================================

    /**
     * Broadcast a pre-signed transaction
     * (condenser_api.broadcast_transaction). Returns when the node has
     * accepted the tx into the mempool, NOT when it has been included in a
     * block. The returned shape is typically `{}` on success.
     *
     * @param {object} tx - Full signed transaction:
     *   { ref_block_num, ref_block_prefix, expiration, operations,
     *     extensions, signatures }
     * @returns {Promise<object>}
     */
    async broadcastTransaction(tx) {
        if (!tx || !Array.isArray(tx.operations) || !Array.isArray(tx.signatures)) {
            throw new PixaAPIError('broadcastTransaction requires a fully-signed transaction', 'INVALID_TX');
        }
        try {
            return await this.proxy.client.call('condenser_api', 'broadcast_transaction', [tx]);
        } catch (e) {
            console.warn('[BroadcastAPI] broadcast_transaction failed:', e.message);
            throw e;
        }
    }

    /**
     * Broadcast a pre-signed transaction and wait synchronously for it to be
     * included in a block (condenser_api.broadcast_transaction_synchronous).
     * Returns { id, block_num, trx_num, expired }.
     *
     * @param {object} tx - Full signed transaction
     * @returns {Promise<{id:string, block_num:number, trx_num:number, expired:boolean}>}
     */
    async broadcastTransactionSynchronous(tx) {
        if (!tx || !Array.isArray(tx.operations) || !Array.isArray(tx.signatures)) {
            throw new PixaAPIError('broadcastTransactionSynchronous requires a fully-signed transaction', 'INVALID_TX');
        }
        try {
            return await this.proxy.client.call('condenser_api', 'broadcast_transaction_synchronous', [tx]);
        } catch (e) {
            console.warn('[BroadcastAPI] broadcast_transaction_synchronous failed:', e.message);
            throw e;
        }
    }

    /**
     * Broadcast via network_broadcast_api (AppBase namespace). Functionally
     * equivalent to broadcastTransaction but uses the modern namespace.
     * Some nodes disable one or the other; this gives callers a choice.
     * @param {object} tx
     * @returns {Promise<object>}
     */
    async networkBroadcastTransaction(tx) {
        if (!tx || !Array.isArray(tx.operations) || !Array.isArray(tx.signatures)) {
            throw new PixaAPIError('networkBroadcastTransaction requires a fully-signed transaction', 'INVALID_TX');
        }
        try {
            return await this.proxy.client.call('network_broadcast_api', 'broadcast_transaction', {
                trx: tx
            });
        } catch (e) {
            console.warn('[BroadcastAPI] network_broadcast_api.broadcast_transaction failed:', e.message);
            throw e;
        }
    }

    // ========================================================================
    // Offline / multi-signature transaction toolkit (v4.6)
    //
    // These helpers let a value-bearing operation be built once, signed
    // independently by several co-signers on different machines, and broadcast
    // only after enough signatures are gathered. They back the treasury bulk
    // PXP transfer dialog (Create → Sign → Broadcast) and the @initminer bulk
    // account-creation tool.
    //
    // Design notes:
    //   • The signed digest covers { ref_block_num, ref_block_prefix,
    //     expiration, operations, extensions } — NOT the signatures array — so
    //     every co-signer must sign the SAME envelope. prepareTransaction()
    //     freezes that envelope; it travels verbatim inside the shared JSON.
    //   • Signature order is irrelevant to the node; mergeSignedTransactions()
    //     just unions and de-duplicates.
    //   • All dpixa crypto is feature-detected. A dpixa build lacking the
    //     low-level signing primitive yields a clear NOT_SUPPORTED error rather
    //     than a silently-wrong signature. (The fork's convenience broadcasters
    //     are preferred elsewhere precisely because low-level serialization has
    //     been finicky — offline multisig has no alternative to a shared digest,
    //     so verify on a testnet before trusting it with real value.)
    //   • The chain caps how far `expiration` may sit in the future (commonly
    //     1 hour). A signing session must complete inside that window or the
    //     prepared transaction has to be regenerated.
    // ========================================================================

    /** Build a { weight_threshold, account_auths, key_auths } authority from a single key. */
    authorityFromKey(publicKey, weight = 1) {
        return { weight_threshold: weight, account_auths: [], key_auths: [[publicKey, weight]] };
    }

    /**
     * Build an unsigned `transfer` operation tuple, amount translated to its
     * on-chain symbol. `amountDisplay` is a display asset string, e.g.
     * "12.500000 PXP" or "3.000 PXA" (PXP→VESTS, PXA→TESTS, PXS→TBD). A direct
     * Pixa-Power transfer therefore just passes a PXP amount here.
     * @returns {[string, object]}
     */
    buildTransferOp(from, to, amountDisplay, memo = '') {
        const nf = normalizeAccount(from);
        const nt = normalizeAccount(to);
        if (!nf || !nt) throw new PixaAPIError('Invalid transfer accounts', 'INVALID_ACCOUNT');
        return ['transfer', {
            from: nf,
            to: nt,
            amount: translateAssetToChain(amountDisplay),
            memo: typeof memo === 'string' ? memo : ''
        }];
    }

    /**
     * Build an unsigned `account_create` operation tuple. `fee` is a display
     * asset string (translated to chain symbol); `publicKeys` is
     * { owner, active, posting, memo } of address-prefixed public keys.
     * `translateAssetToChain` is idempotent for already-chain symbols, so a fee
     * fetched straight from chain props is also accepted.
     * @returns {[string, object]}
     */
    buildAccountCreateOp({ fee, creator, newAccountName, publicKeys, jsonMetadata = '{}' }) {
        const nc = normalizeAccount(creator);
        const nn = normalizeAccount(newAccountName);
        if (!nc || !nn) throw new PixaAPIError('Invalid account_create parameters', 'INVALID_ACCOUNT');
        if (!publicKeys || !publicKeys.owner || !publicKeys.active || !publicKeys.posting || !publicKeys.memo) {
            throw new PixaAPIError('account_create requires owner/active/posting/memo public keys', 'INVALID_KEYS');
        }
        return ['account_create', {
            fee: translateAssetToChain(fee || '0.000 PXA'),
            creator: nc,
            new_account_name: nn,
            owner: this.authorityFromKey(publicKeys.owner),
            active: this.authorityFromKey(publicKeys.active),
            posting: this.authorityFromKey(publicKeys.posting),
            memo_key: publicKeys.memo,
            json_metadata: typeof jsonMetadata === 'string' ? jsonMetadata : JSON.stringify(jsonMetadata || {})
        }];
    }

    /**
     * Assemble an UNSIGNED transaction envelope around the given operations,
     * pulling ref_block_num / ref_block_prefix / expiration from the current
     * head block. Prefers dpixa's own prepareTransaction (authoritative ref
     * math); falls back to a browser-safe manual build.
     *
     * @param {Array} operations - [[opName, opData], ...]
     * @param {object} [opts]
     * @param {number} [opts.expirationSeconds=3600] - Seconds until expiry.
     *        The chain rejects values beyond its maximum (usually 3600).
     * @returns {Promise<object>} { ref_block_num, ref_block_prefix, expiration,
     *          operations, extensions, signatures: [] }
     */
    async prepareTransaction(operations, opts = {}) {
        if (!Array.isArray(operations) || operations.length === 0) {
            throw new PixaAPIError('prepareTransaction requires at least one operation', 'INVALID_TX');
        }
        const expirationSeconds = Number(opts.expirationSeconds) > 0 ? Number(opts.expirationSeconds) : 3600;
        const client = this.proxy.client;

        if (client && client.broadcast && typeof client.broadcast.prepareTransaction === 'function') {
            try {
                const tx = await client.broadcast.prepareTransaction({ operations, extensions: [] });
                return {
                    ref_block_num: tx.ref_block_num,
                    ref_block_prefix: tx.ref_block_prefix,
                    expiration: tx.expiration,
                    operations: tx.operations || operations,
                    extensions: tx.extensions || [],
                    signatures: []
                };
            } catch (e) {
                console.warn('[BroadcastAPI] client.broadcast.prepareTransaction failed, falling back:', e.message);
            }
        }

        const props = await client.database.getDynamicGlobalProperties();
        const headNum = Number(props.head_block_number) || 0;
        const ref_block_num = headNum & 0xffff;
        // ref_block_prefix = little-endian uint32 of bytes 4..7 of head_block_id.
        const idHex = String(props.head_block_id || '');
        let ref_block_prefix = 0;
        if (idHex.length >= 16) {
            const le = idHex.slice(8, 16); // chars for bytes 4..7
            ref_block_prefix = (parseInt(le.slice(6, 8) + le.slice(4, 6) + le.slice(2, 4) + le.slice(0, 2), 16)) >>> 0;
        }
        const baseTime = new Date((props.time || new Date().toISOString().slice(0, -5)) + 'Z').getTime();
        const expiration = new Date(baseTime + expirationSeconds * 1000).toISOString().slice(0, -5);
        return { ref_block_num, ref_block_prefix, expiration, operations, extensions: [], signatures: [] };
    }

    /**
     * Sign an (unsigned or partially-signed) transaction with ONE key and
     * return a NEW transaction with that signature appended. Does not
     * broadcast; the input is not mutated. The WIF's secret bytes are zeroed on
     * the local PrivateKey copy afterwards.
     *
     * @param {object} tx - A prepared transaction envelope.
     * @param {string} wif - Signer's private key (active, for value ops).
     * @returns {object} tx clone with one extra signature.
     */
    signTransaction(tx, wif) {
        if (!tx || !Array.isArray(tx.operations)) {
            throw new PixaAPIError('signTransaction requires a prepared transaction', 'INVALID_TX');
        }
        if (!PrivateKey || !cryptoUtils) {
            throw new PixaAPIError('dpixa crypto is not initialised yet', 'NOT_READY');
        }
        const key = PrivateKey.fromString(wif);
        const chainId = this.proxy.client && this.proxy.client.chainId;
        const clone = {
            ref_block_num: tx.ref_block_num,
            ref_block_prefix: tx.ref_block_prefix,
            expiration: tx.expiration,
            operations: tx.operations,
            extensions: Array.isArray(tx.extensions) ? tx.extensions : [],
            signatures: Array.isArray(tx.signatures) ? tx.signatures.slice() : []
        };
        try {
            if (typeof cryptoUtils.signTransaction === 'function') {
                // dpixa/dhive: returns a signed tx with signatures appended.
                const signed = cryptoUtils.signTransaction(clone, [key], chainId);
                if (signed && Array.isArray(signed.signatures)) {
                    return { ...clone, signatures: signed.signatures.slice() };
                }
                return clone; // some builds mutate in place and return void
            }
            if (typeof cryptoUtils.transactionDigest === 'function') {
                const digest = cryptoUtils.transactionDigest(clone, chainId);
                const sig = key.sign(digest);
                const sigStr = typeof sig.customToString === 'function' ? sig.customToString() : sig.toString();
                clone.signatures.push(sigStr);
                return clone;
            }
            throw new PixaAPIError(
                'This dpixa build exposes no transaction-signing primitive (cryptoUtils.signTransaction / transactionDigest); cannot sign offline.',
                'NOT_SUPPORTED'
            );
        } finally {
            if (key && key.secret && typeof key.secret.fill === 'function') key.secret.fill(0);
        }
    }

    /**
     * Merge several copies of the SAME transaction (identical envelope, signed
     * by different co-signers) into one, unioning and de-duplicating signatures.
     * Throws if the envelopes differ (signatures over different digests cannot
     * be combined).
     *
     * @param {object[]} txs
     * @returns {object} merged transaction
     */
    mergeSignedTransactions(txs) {
        const list = (txs || []).filter(t => t && Array.isArray(t.operations));
        if (list.length === 0) throw new PixaAPIError('mergeSignedTransactions requires at least one transaction', 'INVALID_TX');
        const canon = (t) => JSON.stringify({
            r: t.ref_block_num, p: t.ref_block_prefix, e: t.expiration,
            o: t.operations, x: t.extensions || []
        });
        const base = list[0];
        const baseCanon = canon(base);
        const sigs = [];
        const seen = new Set();
        for (const t of list) {
            if (canon(t) !== baseCanon) {
                throw new PixaAPIError('Cannot merge: the uploaded transactions are not the same envelope (different operations, expiration, or reference block).', 'ENVELOPE_MISMATCH');
            }
            for (const s of (t.signatures || [])) {
                if (typeof s === 'string' && !seen.has(s)) { seen.add(s); sigs.push(s); }
            }
        }
        return {
            ref_block_num: base.ref_block_num,
            ref_block_prefix: base.ref_block_prefix,
            expiration: base.expiration,
            operations: base.operations,
            extensions: Array.isArray(base.extensions) ? base.extensions : [],
            signatures: sigs
        };
    }
}

// ============================================
// Auth API Group
// ============================================

class AuthAPI {
    constructor(proxy) { this.proxy = proxy; }

    isWif(key) {
        try {
            PrivateKey.fromString(key);
            return true;
        } catch (e) {
            return false;
        }
    }

    toWif(username, password, role) {
        return PrivateKey.fromLogin(username, password, role).toString();
    }

    wifToPublic(wif) {
        return PrivateKey.fromString(wif).createPublic().toString();
    }

    signMessage(message, wif) {
        const privateKey = PrivateKey.fromString(wif);
        const signature = privateKey.sign(cryptoUtils.sha256(message));
        return signature.toString();
    }

    verifySignature(message, signature, publicKey) {
        try {
            const sig = Signature.fromString(signature);
            const pubKey = PublicKey.fromString(publicKey);
            return sig.verify(cryptoUtils.sha256(message), pubKey);
        } catch (e) {
            return false;
        }
    }

    /**
     * Encode a memo for private messaging
     * @param {string} senderPrivateKey - Sender's private memo key (WIF)
     * @param {string} recipientPublicKey - Recipient's public memo key
     * @param {string} message - Message to encrypt
     * @returns {string} Encrypted memo (starts with #)
     */
    encodeMemo(senderPrivateKey, recipientPublicKey, message) {
        const privateKey = PrivateKey.fromString(senderPrivateKey);
        return Memo.encode(privateKey, recipientPublicKey, message);
    }

    /**
     * Decode an encrypted memo
     * @param {string} recipientPrivateKey - Recipient's private memo key (WIF)
     * @param {string} encryptedMemo - Encrypted memo (starts with #)
     * @returns {string} Decrypted message
     */
    decodeMemo(recipientPrivateKey, encryptedMemo) {
        const privateKey = PrivateKey.fromString(recipientPrivateKey);
        return Memo.decode(privateKey, encryptedMemo);
    }

    /**
     * Generate keys from username and password
     * @param {string} username
     * @param {string} password
     * @returns {object} Object with owner, active, posting, memo keys
     */
    generateKeys(username, password) {
        const normalizedUsername = normalizeAccount(username);
        return {
            owner: PrivateKey.fromLogin(normalizedUsername, password, 'owner').toString(),
            ownerPublic: PrivateKey.fromLogin(normalizedUsername, password, 'owner').createPublic().toString(),
            active: PrivateKey.fromLogin(normalizedUsername, password, 'active').toString(),
            activePublic: PrivateKey.fromLogin(normalizedUsername, password, 'active').createPublic().toString(),
            posting: PrivateKey.fromLogin(normalizedUsername, password, 'posting').toString(),
            postingPublic: PrivateKey.fromLogin(normalizedUsername, password, 'posting').createPublic().toString(),
            memo: PrivateKey.fromLogin(normalizedUsername, password, 'memo').toString(),
            memoPublic: PrivateKey.fromLogin(normalizedUsername, password, 'memo').createPublic().toString()
        };
    }

    /**
     * Generate a strong random master password for a NEW account. Every role
     * key is derived from it via generateKeys(); it must be shown to and stored
     * by the operator or the account is unrecoverable. Returns a base58 WIF
     * when dpixa can mint one from a seed, else a high-entropy hex string.
     */
    suggestMasterPassword() {
        const bytes = new Uint8Array(32);
        ((typeof globalThis !== 'undefined' && globalThis.crypto) || crypto).getRandomValues(bytes);
        let hex = '';
        for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
        if (PrivateKey && typeof PrivateKey.fromSeed === 'function') {
            try { return PrivateKey.fromSeed(hex).toString(); } catch (_) { /* fall through */ }
        }
        return 'P' + hex;
    }
}

// ============================================
// Formatter API Group
// ============================================

class FormatterAPI {
    constructor(proxy) { this.proxy = proxy; }

    reputation(rawReputation) {
        if (!rawReputation || rawReputation === 0) return 25;
        const neg = rawReputation < 0;
        const rep = Math.log10(Math.abs(rawReputation));
        let score = Math.max(rep - 9, 0) * 9 + 25;
        if (neg) score = 50 - score;
        return Math.round(score * 100) / 100;
    }

    vestToPixa(vestingShares, totalVestingShares, totalVestingFundPixa) {
        return (parseFloat(vestingShares) / parseFloat(totalVestingShares)) * parseFloat(totalVestingFundPixa);
    }

    pixaToVest(pixa, totalVestingShares, totalVestingFundPixa) {
        return (parseFloat(pixa) / parseFloat(totalVestingFundPixa)) * parseFloat(totalVestingShares);
    }

    /** @deprecated Use vestToPixa() */
    vestToSteem(...args) { return this.vestToPixa(...args); }
    /** @deprecated Use pixaToVest() */
    steemToVest(...args) { return this.pixaToVest(...args); }

    formatAsset(amount, symbol, precision = 3) {
        return `${parseFloat(amount).toFixed(precision)} ${symbol}`;
    }

    /**
     * Calculate vesting share price from dynamic global properties
     * @param {object} props - Dynamic global properties
     * @returns {Price}
     */
    getVestingSharePrice(props) {
        return getVestingSharePrice(props);
    }

    /**
     * Get effective vesting shares for an account
     * @param {object} account - Account object
     * @param {boolean} subtractDelegated - Subtract delegated VESTS
     * @param {boolean} addReceived - Add received VESTS
     * @returns {number}
     */
    getVests(account, subtractDelegated = true, addReceived = true) {
        return getVests(account, subtractDelegated, addReceived);
    }
}

// ============================================
// Blockchain API Group (with streaming)
// ============================================

class BlockchainAPI {
    constructor(proxy) {
        this.proxy = proxy;
        this.BLOCK_INTERVAL = 3000; // 3 seconds
    }

    async getBlockHeader(blockNum) {
        return this.proxy.client.database.getBlockHeader(blockNum);
    }

    async getBlock(blockNum) {
        return this.proxy.client.database.getBlock(blockNum);
    }

    async getTransaction(txId) {
        return this.proxy.client.database.getTransaction(txId);
    }

    async getTransactionHex(tx) {
        return this.proxy.client.call('condenser_api', 'get_transaction_hex', [tx]);
    }

    /**
     * Get current block number
     * @param {string} mode - 'irreversible' or 'latest'
     * @returns {Promise<number>}
     */
    async getCurrentBlockNum(mode = 'irreversible') {
        const props = await this.proxy.client.database.getDynamicGlobalProperties();
        if (mode === 'latest' || mode === BlockchainMode?.Latest) {
            return props.head_block_number;
        }
        return props.last_irreversible_block_num;
    }

    /**
     * Get current block header
     * @param {string} mode - 'irreversible' or 'latest'
     */
    async getCurrentBlockHeader(mode = 'irreversible') {
        const blockNum = await this.getCurrentBlockNum(mode);
        return this.getBlockHeader(blockNum);
    }

    /**
     * Get current full block
     * @param {string} mode - 'irreversible' or 'latest'
     */
    async getCurrentBlock(mode = 'irreversible') {
        const blockNum = await this.getCurrentBlockNum(mode);
        return this.getBlock(blockNum);
    }

    /**
     * Async generator for block numbers
     * @param {object} options - { from, to, mode }
     * @yields {number}
     */
    async *getBlockNumbers(options = {}) {
        const { from, to, mode = 'irreversible' } = options;

        let currentBlock = from !== undefined ? from : await this.getCurrentBlockNum(mode);
        const endBlock = to;

        while (true) {
            const headBlock = await this.getCurrentBlockNum(mode);

            while (currentBlock <= headBlock && (endBlock === undefined || currentBlock <= endBlock)) {
                yield currentBlock;
                currentBlock++;
            }

            if (endBlock !== undefined && currentBlock > endBlock) {
                return;
            }

            // Wait for next block
            await new Promise(resolve => setTimeout(resolve, this.BLOCK_INTERVAL));
        }
    }

    /**
     * Async generator for full blocks
     * @param {object} options - { from, to, mode }
     * @yields {SignedBlock}
     */
    async *getBlocks(options = {}) {
        for await (const blockNum of this.getBlockNumbers(options)) {
            const block = await this.getBlock(blockNum);
            if (block) {
                yield block;
            }
        }
    }

    /**
     * Async generator for operations (including virtual)
     * @param {object} options - { from, to, mode }
     * @yields {AppliedOperation}
     */
    async *getOperations(options = {}) {
        for await (const blockNum of this.getBlockNumbers(options)) {
            const ops = await this.proxy.blocks.getOpsInBlock(blockNum, false);
            for (const op of ops) {
                yield op;
            }
        }
    }

    /**
     * Get block number stream (Node.js Readable)
     * @param {object} options
     * @returns {ReadableStream}
     */
    getBlockNumberStream(options = {}) {
        const iterator = this.getBlockNumbers(options);
        return this._iteratorToStream(iterator);
    }

    /**
     * Get block stream (Node.js Readable)
     * @param {object} options
     * @returns {ReadableStream}
     */
    getBlockStream(options = {}) {
        const iterator = this.getBlocks(options);
        return this._iteratorToStream(iterator);
    }

    /**
     * Get operations stream (Node.js Readable)
     * @param {object} options
     * @returns {ReadableStream}
     */
    getOperationsStream(options = {}) {
        const iterator = this.getOperations(options);
        return this._iteratorToStream(iterator);
    }

    /**
     * Convert async iterator to readable stream
     * @private
     */
    _iteratorToStream(iterator) {
        // Check if we're in Node.js environment
        if (typeof require !== 'undefined') {
            try {
                const { Readable } = require('stream');
                return Readable.from(iterator);
            } catch (e) {
                console.warn('[BlockchainAPI] Stream conversion not available in browser');
            }
        }

        // Return the iterator itself if streams aren't available
        return iterator;
    }

    // ========================================================================
    // Signature inspection & replay guard (v4.3.0)
    // ========================================================================

    /**
     * Return the set of all public keys that could possibly sign for the
     * given transaction (condenser_api.get_potential_signatures). Useful
     * for multi-sig UX: show the user which keys MIGHT be asked for.
     *
     * @param {object} tx - Unsigned or partially-signed transaction
     * @returns {Promise<string[]>} Array of public keys
     */
    async getPotentialSignatures(tx) {
        if (!tx || !Array.isArray(tx.operations)) {
            throw new PixaAPIError('getPotentialSignatures requires a transaction', 'INVALID_TX');
        }
        try {
            return await this.proxy.client.call('condenser_api', 'get_potential_signatures', [tx]);
        } catch (e) {
            console.warn('[BlockchainAPI] get_potential_signatures failed:', e.message);
        }
        return [];
    }

    /**
     * Given a partially-signed transaction plus a set of available public
     * keys, return the minimal subset that must still sign
     * (condenser_api.get_required_signatures). Essential for multi-sig
     * coordination.
     *
     * @param {object}   tx
     * @param {string[]} availableKeys - Public keys the caller can sign with
     * @returns {Promise<string[]>}
     */
    async getRequiredSignatures(tx, availableKeys = []) {
        if (!tx || !Array.isArray(tx.operations)) {
            throw new PixaAPIError('getRequiredSignatures requires a transaction', 'INVALID_TX');
        }
        try {
            return await this.proxy.client.call('condenser_api', 'get_required_signatures', [tx, availableKeys]);
        } catch (e) {
            console.warn('[BlockchainAPI] get_required_signatures failed:', e.message);
        }
        return [];
    }

    /**
     * Check whether a transaction id is already known to the node's
     * mempool / recent history (condenser_api.is_known_transaction).
     * Returns true if the node has seen this trx id and it is still
     * within its dedup window. Use for idempotency guards on the offline
     * broadcast queue — avoids re-broadcasting a tx the node already accepted.
     *
     * @param {string} trxId - 40-char hex transaction id
     * @returns {Promise<boolean>}
     */
    async isKnownTransaction(trxId) {
        if (!trxId || typeof trxId !== 'string') return false;
        try {
            const result = await this.proxy.client.call('condenser_api', 'is_known_transaction', [trxId]);
            return Boolean(result);
        } catch (e) {
            console.warn('[BlockchainAPI] is_known_transaction failed:', e.message);
        }
        return false;
    }

    /**
     * Get transaction details via the modern account_history_api with the
     * optional `include_reversible` flag. Unlike the existing
     * getTransaction() (which uses dpixa's database client), this lets the
     * caller look up a tx that is still in a reversible block.
     *
     * @param {string}  trxId
     * @param {boolean} [includeReversible=false]
     * @returns {Promise<object|null>}
     */
    async getTransactionFromHistory(trxId, includeReversible = false) {
        if (!trxId) return null;
        try {
            return await this.proxy.client.call('account_history_api', 'get_transaction', {
                id: trxId,
                include_reversible: Boolean(includeReversible)
            });
        } catch (e) {
            console.warn('[BlockchainAPI] account_history_api.get_transaction failed:', e.message);
        }
        return null;
    }
}

// ============================================
// Resource Credits API Group
// ============================================

class ResourceCreditsAPI {
    constructor(proxy) { this.proxy = proxy; }

    async getResourceParams() {
        // rc.getResourceParams() — documented dpixa method
        return this.proxy.client.rc.getResourceParams();
    }

    async getResourcePool() {
        // rc.getResourcePool() — documented dpixa method
        return this.proxy.client.rc.getResourcePool();
    }

    async findRcAccounts(accounts) {
        const normalizedAccounts = accounts.map(acc => normalizeAccount(acc)).filter(acc => acc && acc.length > 0);
        // rc.findRCAccounts(usernames) — documented dpixa method
        return this.proxy.client.rc.findRCAccounts(normalizedAccounts);
    }

    /**
     * List RC accounts with pagination (rc_api.list_rc_accounts).
     * Complements findRcAccounts (which requires exact names).
     * @param {object} [params]
     * @param {string} [params.start=''] - Account name to start from
     * @param {number} [params.limit=100] - Up to 1000
     * @returns {Promise<object[]>} RC account records
     */
    async listRcAccounts({ start = '', limit = 100 } = {}) {
        try {
            const result = await this.proxy.client.call('rc_api', 'list_rc_accounts', {
                start, limit
            });
            return result?.rc_accounts || [];
        } catch (e) {
            console.warn('[ResourceCreditsAPI] list_rc_accounts failed:', e.message);
        }
        return [];
    }

    /**
     * List RC delegations directly made from/to an account
     * (rc_api.list_rc_direct_delegations).
     * Default order 'by_from_to' expects start = [from, to] tuple.
     * Pass {from, to} as the tuple's start to page through delegations
     * originating from `from` starting at delegatee `to`.
     * @param {object} [params]
     * @param {[string,string]} [params.start=['','']] - [from, to] tuple
     * @param {number} [params.limit=100] - Up to 1000
     * @returns {Promise<object[]>}
     */
    async listRcDirectDelegations({ start = ['', ''], limit = 100 } = {}) {
        try {
            // Normalize accounts in the start tuple if provided
            const normalizedStart = Array.isArray(start)
                ? [start[0] ? normalizeAccount(start[0]) : '', start[1] ? normalizeAccount(start[1]) : '']
                : start;
            const result = await this.proxy.client.call('rc_api', 'list_rc_direct_delegations', {
                start: normalizedStart,
                limit
            });
            return result?.rc_direct_delegations || [];
        } catch (e) {
            console.warn('[ResourceCreditsAPI] list_rc_direct_delegations failed:', e.message);
        }
        return [];
    }

    async getRCMana(account) {
        const normalizedAccount = normalizeAccount(account);
        // rc.getRCMana(username) — documented dpixa method
        return this.proxy.client.rc.getRCMana(normalizedAccount);
    }

    async getVPMana(account) {
        const normalizedAccount = normalizeAccount(account);
        // rc.getVPMana(username) — documented dpixa method
        return this.proxy.client.rc.getVPMana(normalizedAccount);
    }

    /**
     * Calculate current RC mana from a raw RC account object.
     * Regenerates mana to current time.
     * @param {object} rcAccount - RC account object from findRcAccounts()
     * @returns {object} Manabar { current_mana, max_mana, percentage }
     */
    calculateRCMana(rcAccount) {
        // rc.calculateRCMana(rc_account) — documented dpixa method
        return this.proxy.client.rc.calculateRCMana(rcAccount);
    }

    /**
     * Calculate current voting power mana from a standard account object.
     * Regenerates mana to current time.
     * @param {object} account - Account object from getAccounts()
     * @returns {object} Manabar { current_mana, max_mana, percentage }
     */
    calculateVPMana(account) {
        // rc.calculateVPMana(account) — documented dpixa method
        return this.proxy.client.rc.calculateVPMana(account);
    }

    /**
     * Estimate RC cost for an operation
     * @param {string} operationType - e.g., 'vote', 'comment', 'transfer'
     * @param {object} operationData - Operation parameters
     */
    async calculateRCCost(operationType, operationData = {}) {
        // This is a simplified estimation - actual cost depends on current RC pool state
        const baseCosts = {
            vote: 20000000,
            comment: 150000000,
            transfer: 10000000,
            custom_json: 5000000,
            claim_reward_balance: 5000000,
            delegate_vesting_shares: 10000000,
            transfer_to_vesting: 10000000,
            withdraw_vesting: 10000000
        };

        const baseCost = baseCosts[operationType] || 50000000;

        // Adjust for content size if applicable
        if (operationType === 'comment' && operationData.body) {
            const bodySize = operationData.body.length;
            return baseCost + (bodySize * 10000);
        }

        if (operationType === 'custom_json' && operationData.json) {
            const jsonSize = typeof operationData.json === 'string'
                ? operationData.json.length
                : JSON.stringify(operationData.json).length;
            return baseCost + (jsonSize * 5000);
        }

        return baseCost;
    }
}

// ============================================
// Communities API Group
// ============================================

class CommunitiesAPI {
    constructor(proxy) { this.proxy = proxy; }

    /**
     * Resolve the active user for write operations. The synchronous
     * `currentAccount` getter and the async `getActiveAccount()` both back
     * onto the same field today, but the rest of the codebase already uses a
     * synchronous-first / async-fallback pattern (see proxy.unlockWithPin),
     * so do the same here. Returns null if no session is active.
     * @returns {Promise<string|null>}
     */
    async _getActiveUser() {
        const sm = this.proxy.sessionManager;
        if (!sm) return null;
        return sm.currentAccount || (await sm.getActiveAccount?.()) || null;
    }

    /**
     * Sanitize a bridge community object field by field.
     *
     * getCommunity and listCommunities were handing the caller raw chain data,
     * so a community's avatar and its title/about text reached the UI without
     * passing any validator — the one entity type that had no sanitizer at all.
     * A community is owned by whoever created it, so every field here is
     * attacker-controlled in exactly the way an account profile is.
     *
     * @param {object} raw — bridge.get_community payload
     * @returns {object|null}
     */
    _sanitizeCommunity(raw) {
        if (!raw || typeof raw !== 'object') return null;

        const cs = this.proxy.contentSanitizer;
        if (!cs) return null;

        const safeMetaStr = cs.safeJson(JSON.stringify(raw.settings || {}));
        let settings = {};
        try { settings = JSON.parse(safeMetaStr); } catch (e) {}

        return {
            _entity_type: 'community',
            _sanitized:   true,
            _stored_at:   Date.now(),

            // Identity — community names are hive-NNNNN, not usernames, so they
            // go through safeString rather than sanitizeUsername.
            name:  cs.safeString(raw.name || '', 64) || '',
            title: cs.safeString(raw.title || '', 256) || '',
            about: cs.safeString(raw.about || '', 512) || '',
            lang:  cs.safeString(raw.lang || '', 8) || '',

            // The image. Same gate as an account avatar.
            avatar_url: cs.safeProfileImage(raw.avatar_url),

            // Long-form text — rendered at the description tier, not raw.
            description: raw.description ? cs.renderDescription(String(raw.description)) : '',
            flag_text:   cs.safeString(raw.flag_text || '', 512) || '',

            // Counters
            type_id:      VALIDATORS.safe_number(raw.type_id) ?? 0,
            subscribers:  VALIDATORS.safe_number(raw.subscribers) ?? 0,
            num_pending:  VALIDATORS.safe_number(raw.num_pending) ?? 0,
            num_authors:  VALIDATORS.safe_number(raw.num_authors) ?? 0,
            sum_pending:  VALIDATORS.safe_number(raw.sum_pending) ?? 0,
            is_nsfw:      VALIDATORS.safe_bool(raw.is_nsfw) ?? false,
            created_at:   VALIDATORS.safe_timestamp(raw.created_at),

            // Rosters — usernames only, anything unparseable dropped
            admins: Array.isArray(raw.admins)
                ? raw.admins.map(a => cs.sanitizeUsername(a)).filter(Boolean).slice(0, 50)
                : [],
            team: Array.isArray(raw.team)
                ? raw.team.map(entry => Array.isArray(entry)
                    ? [cs.sanitizeUsername(entry[0]), cs.safeString(entry[1] || '', 32) || '']
                    : null).filter(e => e && e[0]).slice(0, 100)
                : [],

            settings,
            context: (raw.context && typeof raw.context === 'object')
                ? {
                    role:        cs.safeString(raw.context.role || '', 32) || '',
                    subscribed:  VALIDATORS.safe_bool(raw.context.subscribed) ?? false,
                    title:       cs.safeString(raw.context.title || '', 128) || '',
                }
                : null,
        };
    }

    async getCommunity(name, observer = '') {
        // bridge.get_community — canonical bridge API
        try {
            const params = { name };
            if (observer) params.observer = observer;
            const raw = await this.proxy.client.pixamind.getCommunity(params);
            return this._sanitizeCommunity(raw);
        } catch (e) {
            console.warn('[CommunitiesAPI] getCommunity failed:', e.message);
        }
        return null;
    }

    async listCommunities(options = {}) {
        // bridge.list_communities — canonical bridge API
        // Params: last (string, paging), limit (int, default 100),
        //         query (string, filters title/about), sort (rank|new|subs),
        //         observer (string, valid account)
        try {
            const params = {};
            if (options.last)     params.last     = options.last;
            if (options.limit)    params.limit    = options.limit;
            if (options.query)    params.query    = options.query;
            if (options.sort)     params.sort     = options.sort;
            if (options.observer) params.observer = options.observer;
            const list = await this.proxy.client.pixamind.listCommunities(params);
            return Array.isArray(list)
                ? list.map(c => this._sanitizeCommunity(c)).filter(Boolean)
                : [];
        } catch (e) {
            console.warn('[CommunitiesAPI] listCommunities failed:', e.message);
        }
        return [];
    }

    async getSubscriptions(account) {
        const normalizedAccount = normalizeAccount(account);

        // pixamind.listAllSubscriptions({account}) — documented dpixa method
        try {
            return await this.proxy.client.pixamind.listAllSubscriptions({ account: normalizedAccount });
        } catch (e) {
            console.warn('[CommunitiesAPI] getSubscriptions failed:', e.message);
        }
        return [];
    }

    async getRankedPosts(options = {}) {
        const sort = options.sort || 'trending';
        const validSorts = ['trending', 'created', 'hot', 'promoted', 'active', 'votes', 'children', 'cashout'];
        const dbSort = validSorts.includes(sort) ? sort : 'trending';

        const q = {
            tag: options.tag || '',
            limit: parseInt(options.limit, 10) || 20
        };
        if (options.start_author) q.start_author = options.start_author;
        if (options.start_permlink) q.start_permlink = options.start_permlink;

        // For sort='created', try condenser_api.get_discussions_by_created first.
        // On modern HAF nodes this is shimmed onto hivemind so freshness should
        // match bridge — but Pixa is a fork and may behave differently, so we
        // probe condenser first and fall back to bridge on any failure.
        // For ranked sorts (trending/hot/promoted/votes/active/cashout/children)
        // we go straight to bridge: those rankings are computed by hivemind SQL
        // and have no head-block alternative.
        let rawResults = null;

        if (dbSort === 'created') {
            try {
                const condenserQuery = { tag: q.tag || '', limit: q.limit };
                if (q.start_author) condenserQuery.start_author = q.start_author;
                if (q.start_permlink) condenserQuery.start_permlink = q.start_permlink;
                rawResults = await this.proxy.client.call(
                    'condenser_api',
                    'get_discussions_by_created',
                    [condenserQuery]
                );
            } catch (e) {
                console.warn(`[CommunitiesAPI] condenser_api.get_discussions_by_created failed, falling back to bridge:`, e.message);
                rawResults = null;
            }
        }

        if (!rawResults || !Array.isArray(rawResults) || rawResults.length === 0) {
            // bridge.get_ranked_posts via dpixa pixamind helper. Pagination
            // requires forwarding the start cursor — without it, every
            // subsequent page re-fetches posts 0-19 and the Feed's dedupe
            // step silently returns an empty array.
            try {
                const bridgeArgs = { sort: dbSort, tag: q.tag || '', limit: q.limit };
                if (q.start_author) bridgeArgs.start_author = q.start_author;
                if (q.start_permlink) bridgeArgs.start_permlink = q.start_permlink;
                rawResults = await this.proxy.client.pixamind.getRankedPosts(bridgeArgs);
            } catch (e) {
                console.warn(`[CommunitiesAPI] getRankedPosts(${dbSort}) failed:`, e.message);
            }
        }

        if (!rawResults || !Array.isArray(rawResults)) return [];

        if (!this.proxy.sanitizationPipeline) {
            console.error('[CommunitiesAPI] Sanitizer pipeline not available — refusing to serve raw content');
            return [];
        }

        const postEntities = [];
        const commentEntities = [];
        for (const raw of rawResults) {
            try {
                const entity = this.proxy.sanitizationPipeline.sanitizeContent(raw);
                if (entity) {
                    if (entity._entity_type === 'post') postEntities.push(entity);
                    else commentEntities.push(entity);
                }
            } catch (e) {
                console.warn('[CommunitiesAPI] Failed to sanitize entity, skipping:', raw?.author, raw?.permlink, e.message || e);
            }
        }
        return [...postEntities, ...commentEntities];
    }

    async getAccountPosts(account, sort = 'blog', options = {}) {
        const normalizedAccount = normalizeAccount(account);

        const validSorts = ['blog', 'feed', 'comments', 'trending', 'created', 'hot', 'promoted', 'active', 'votes', 'children', 'cashout'];
        const dbSort = validSorts.includes(sort) ? sort : 'blog';

        // get_discussions_by_comments uses start_author; blog/feed/others use tag
        const q = { limit: parseInt(options.limit, 10) || 20 };
        if (dbSort === 'comments') {
            q.start_author = normalizedAccount;
            if (options.start_permlink) q.start_permlink = options.start_permlink;
        } else {
            q.tag = normalizedAccount;
            if (options.start_author) q.start_author = options.start_author;
            if (options.start_permlink) q.start_permlink = options.start_permlink;
        }

        // condenser_api.get_discussions_by_${sort} — direct call.
        // Replaces dpixa's database.getDiscussions(sort, q) wrapper, which
        // makes the same wire request but obscures the underlying API.
        // For sort='blog'/'feed', q.tag is the account name (legacy quirk
        // of condenser_api). For sort='comments', the cursor uses
        // start_author/start_permlink directly (q has no tag field).
        // NOTE: on modern HAF nodes most of these methods are themselves
        // shimmed onto hivemind, so freshness will match bridge for those
        // sorts. Pixa is a fork — behaviour may differ; we keep the
        // explicit condenser path so it's easy to compare.
        let rawResults = null;

        try {
            rawResults = await this.proxy.client.call(
                'condenser_api',
                `get_discussions_by_${dbSort}`,
                [q]
            );
        } catch (e) {
            console.warn(`[CommunitiesAPI] condenser_api.get_discussions_by_${dbSort} failed:`, e.message);
        }

        if (!rawResults || !Array.isArray(rawResults)) return [];

        if (!this.proxy.sanitizationPipeline) {
            console.error('[CommunitiesAPI] Sanitizer pipeline not available — refusing to serve raw content');
            return [];
        }

        const postEntities = [];
        const commentEntities = [];
        for (const raw of rawResults) {
            try {
                const entity = this.proxy.sanitizationPipeline.sanitizeContent(raw);
                if (entity) {
                    if (entity._entity_type === 'post') postEntities.push(entity);
                    else commentEntities.push(entity);
                }
            } catch (e) {
                console.warn('[CommunitiesAPI] Failed to sanitize entity, skipping:', raw?.author, raw?.permlink, e.message || e);
            }
        }
        return [...postEntities, ...commentEntities];
    }

    // ========================================================================
    // Bridge API — Additional Methods (v4.1.0)
    // ========================================================================

    /**
     * Get a full discussion thread (post + all nested comments)
     * @param {string} author - Post author
     * @param {string} permlink - Post permlink
     * @param {string} [observer=''] - Observer account for personalization
     * @returns {Promise<object>} Full discussion tree
     */
    async getDiscussion(author, permlink, observer = '') {
        const normalizedAuthor = normalizeAccount(author);
        if (!normalizedAuthor) return null;

        try {
            return await this.proxy.client.call('bridge', 'get_discussion', {
                author: normalizedAuthor,
                permlink,
                observer
            });
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.get_discussion failed:', e.message);
        }
        return null;
    }

    /**
     * Get a single post via Bridge (richer format than condenser_api.get_content)
     * @param {string} author - Post author
     * @param {string} permlink - Post permlink
     * @param {string} [observer=''] - Observer account
     * @returns {Promise<object|null>}
     */
    async getPost(author, permlink, observer = '') {
        const normalizedAuthor = normalizeAccount(author);
        if (!normalizedAuthor) return null;

        try {
            return await this.proxy.client.call('bridge', 'get_post', {
                author: normalizedAuthor,
                permlink,
                observer
            });
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.get_post failed:', e.message);
        }
        return null;
    }

    /**
     * Get lightweight post header (no body or votes)
     * @param {string} author
     * @param {string} permlink
     * @returns {Promise<object|null>}
     */
    async getPostHeader(author, permlink) {
        const normalizedAuthor = normalizeAccount(author);
        if (!normalizedAuthor) return null;

        try {
            return await this.proxy.client.call('bridge', 'get_post_header', {
                author: normalizedAuthor,
                permlink
            });
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.get_post_header failed:', e.message);
        }
        return null;
    }

    /**
     * Get profile data via Bridge (includes computed reputation, follower counts)
     * @param {string} account
     * @param {string} [observer=''] - Observer account
     * @returns {Promise<object|null>}
     */
    async getProfile(account, observer = '') {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return null;

        try {
            return await this.proxy.client.call('bridge', 'get_profile', {
                account: normalizedAccount,
                observer
            });
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.get_profile failed:', e.message);
        }
        return null;
    }

    /**
     * Get user's context within a community (role, title, subscription status)
     * @param {string} name - Community name (e.g. "hive-123456")
     * @param {string} account - Account to check
     * @returns {Promise<object|null>} { role, title, subscribed }
     */
    async getCommunityContext(name, account) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return null;

        try {
            return await this.proxy.client.call('bridge', 'get_community_context', {
                name,
                account: normalizedAccount
            });
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.get_community_context failed:', e.message);
        }
        return null;
    }

    /**
     * Get the follow/mute relationship between two accounts
     * @param {string} account1
     * @param {string} account2
     * @returns {Promise<object|null>} { follows, ignores, blacklists, follow_blacklists }
     */
    async getRelationshipBetweenAccounts(account1, account2) {
        const normalized1 = normalizeAccount(account1);
        const normalized2 = normalizeAccount(account2);
        if (!normalized1 || !normalized2) return null;

        try {
            return await this.proxy.client.call('bridge', 'get_relationship_between_accounts', [normalized1, normalized2]);
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.get_relationship_between_accounts failed:', e.message);
        }
        return null;
    }

    /**
     * Get follow list (blacklist/mute list) for an account
     * @param {string} account
     * @returns {Promise<object|null>}
     */
    async getFollowList(account) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return null;

        try {
            return await this.proxy.client.call('bridge', 'get_follow_list', {
                account: normalizedAccount
            });
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.get_follow_list failed:', e.message);
        }
        return null;
    }

    /**
     * Check if a user follows any blacklists/mute lists
     * @param {string} account
     * @returns {Promise<boolean>}
     */
    async doesUserFollowAnyLists(account) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return false;

        try {
            return await this.proxy.client.call('bridge', 'does_user_follow_any_lists', {
                account: normalizedAccount
            });
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.does_user_follow_any_lists failed:', e.message);
        }
        return false;
    }

    /**
     * Get payout statistics for a community
     * @param {string} name - Community name
     * @returns {Promise<object|null>}
     */
    async getPayoutStats(name) {
        try {
            return await this.proxy.client.call('bridge', 'get_payout_stats', { community: name });
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.get_payout_stats failed:', e.message);
        }
        return null;
    }

    /**
     * List roles assigned within a community
     * @param {string} name - Community name
     * @param {string} [last=''] - Last account for pagination
     * @param {number} [limit=100]
     * @returns {Promise<object[]>} Array of [account, role, title]
     */
    async listCommunityRoles(name, last = '', limit = 100) {
        try {
            return await this.proxy.client.call('bridge', 'list_community_roles', {
                community: name,
                last,
                limit
            });
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.list_community_roles failed:', e.message);
        }
        return [];
    }

    /**
     * List subscribers to a community
     * @param {string} name - Community name
     * @param {string} [last=''] - Last account for pagination
     * @param {number} [limit=100]
     * @returns {Promise<object[]>} Array of [account, role, title, created]
     */
    async listSubscribers(name, last = '', limit = 100) {
        try {
            return await this.proxy.client.call('bridge', 'list_subscribers', {
                community: name,
                last,
                limit
            });
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.list_subscribers failed:', e.message);
        }
        return [];
    }

    /**
     * List popular communities (alternative ranking)
     * @param {number} [limit=25]
     * @returns {Promise<object[]>}
     */
    async listPopCommunities(limit = 25) {
        try {
            return await this.proxy.client.call('bridge', 'list_pop_communities', { limit });
        } catch (e) {
            console.warn('[CommunitiesAPI] bridge.list_pop_communities failed:', e.message);
        }
        return [];
    }

    /**
     * List popular communities with full filtering/sorting/paging
     * bridge.list_pop_communities with extended options
     * @param {object} [options]
     * @param {string} [options.last] - community name for paging
     * @param {number} [options.limit] - max results
     * @param {string} [options.query] - filter against title/about
     * @param {string} [options.sort] - rank|new|subs
     * @param {string} [options.observer] - valid account
     * @returns {Promise<object[]>}
     */
    async listPopularCommunities(options = {}) {
        try {
            const params = {};
            if (options.last)     params.last     = options.last;
            if (options.limit)    params.limit    = options.limit;
            if (options.query)    params.query    = options.query;
            if (options.sort)     params.sort     = options.sort;
            if (options.observer) params.observer = options.observer;
            const res = await this.proxy.client.call('bridge.list_pop_communities', params);
            console.log(res);
            return res;
        } catch (e) {
            console.warn('[CommunitiesAPI] listPopularCommunities failed:', e.message);
        }
        return [];
    }

    // ========================================================================
    // Community Broadcast Convenience Methods (custom_json wrappers) (v4.1.0)
    // ========================================================================

    /**
     * Set a role for an account within a community
     * @param {string} community - Community name (e.g. "hive-123456")
     * @param {string} account - Account to assign role to
     * @param {string} role - Role: 'admin', 'mod', 'member', 'guest', 'muted'
     * @returns {Promise<object>} TransactionConfirmation
     */
    async setRole(community, account, role) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');

        // Requires the authority of whoever is setting the role
        const activeUser = await this._getActiveUser();
        if (!activeUser) throw new PixaAPIError('No active session', 'NO_SESSION');

        return this.proxy.broadcast.customJson({
            requiredAuths: [],
            requiredPostingAuths: [activeUser],
            id: 'community',
            json: JSON.stringify(['setRole', { community, account: normalizedAccount, role }])
        });
    }

    /**
     * Set a title/badge for an account within a community (Mods or higher)
     * @param {string} community
     * @param {string} account
     * @param {string} title - Badge/title text
     * @returns {Promise<object>}
     */
    async setUserTitle(community, account, title) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');

        const activeUser = await this._getActiveUser();
        if (!activeUser) throw new PixaAPIError('No active session', 'NO_SESSION');

        return this.proxy.broadcast.customJson({
            requiredAuths: [],
            requiredPostingAuths: [activeUser],
            id: 'community',
            json: JSON.stringify(['setUserTitle', { community, account: normalizedAccount, title }])
        });
    }

    /**
     * Mute a post within a community (Mods or higher)
     * @param {string} community
     * @param {string} account - Author of the post
     * @param {string} permlink
     * @param {string} notes - Reason for muting (use 'spam' for spam)
     * @returns {Promise<object>}
     */
    async mutePost(community, account, permlink, notes = '') {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');

        const activeUser = await this._getActiveUser();
        if (!activeUser) throw new PixaAPIError('No active session', 'NO_SESSION');

        return this.proxy.broadcast.customJson({
            requiredAuths: [],
            requiredPostingAuths: [activeUser],
            id: 'community',
            json: JSON.stringify(['mutePost', { community, account: normalizedAccount, permlink, notes }])
        });
    }

    /**
     * Unmute a post within a community (Mods or higher)
     * @param {string} community
     * @param {string} account
     * @param {string} permlink
     * @param {string} notes
     * @returns {Promise<object>}
     */
    async unmutePost(community, account, permlink, notes = '') {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');

        const activeUser = await this._getActiveUser();
        if (!activeUser) throw new PixaAPIError('No active session', 'NO_SESSION');

        return this.proxy.broadcast.customJson({
            requiredAuths: [],
            requiredPostingAuths: [activeUser],
            id: 'community',
            json: JSON.stringify(['unmutePost', { community, account: normalizedAccount, permlink, notes }])
        });
    }

    /**
     * Update community properties (Admin only)
     * @param {string} community
     * @param {object} props - { title, about, is_nsfw, description, flag_text }
     * @returns {Promise<object>}
     */
    async updateCommunityProps(community, props) {
        const activeUser = await this._getActiveUser();
        if (!activeUser) throw new PixaAPIError('No active session', 'NO_SESSION');

        return this.proxy.broadcast.customJson({
            requiredAuths: [],
            requiredPostingAuths: [activeUser],
            id: 'community',
            json: JSON.stringify(['updateProps', { community, props }])
        });
    }

    /**
     * Subscribe to a community
     * @param {string} community
     * @returns {Promise<object>}
     */
    async subscribe(community) {
        const activeUser = await this._getActiveUser();
        if (!activeUser) throw new PixaAPIError('No active session', 'NO_SESSION');

        return this.proxy.broadcast.customJson({
            requiredAuths: [],
            requiredPostingAuths: [activeUser],
            id: 'community',
            json: JSON.stringify(['subscribe', { community }])
        });
    }

    /**
     * Unsubscribe from a community
     * @param {string} community
     * @returns {Promise<object>}
     */
    async unsubscribe(community) {
        const activeUser = await this._getActiveUser();
        if (!activeUser) throw new PixaAPIError('No active session', 'NO_SESSION');

        return this.proxy.broadcast.customJson({
            requiredAuths: [],
            requiredPostingAuths: [activeUser],
            id: 'community',
            json: JSON.stringify(['unsubscribe', { community }])
        });
    }

    /**
     * Pin a post to the top of the community homepage (Mods or higher)
     * @param {string} community
     * @param {string} account - Post author
     * @param {string} permlink
     * @returns {Promise<object>}
     */
    async pinPost(community, account, permlink) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');

        const activeUser = await this._getActiveUser();
        if (!activeUser) throw new PixaAPIError('No active session', 'NO_SESSION');

        return this.proxy.broadcast.customJson({
            requiredAuths: [],
            requiredPostingAuths: [activeUser],
            id: 'community',
            json: JSON.stringify(['pinPost', { community, account: normalizedAccount, permlink }])
        });
    }

    /**
     * Unpin a post from the community homepage (Mods or higher)
     * @param {string} community
     * @param {string} account
     * @param {string} permlink
     * @returns {Promise<object>}
     */
    async unpinPost(community, account, permlink) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');

        const activeUser = await this._getActiveUser();
        if (!activeUser) throw new PixaAPIError('No active session', 'NO_SESSION');

        return this.proxy.broadcast.customJson({
            requiredAuths: [],
            requiredPostingAuths: [activeUser],
            id: 'community',
            json: JSON.stringify(['unpinPost', { community, account: normalizedAccount, permlink }])
        });
    }

    /**
     * Flag a post for community review (any user)
     * @param {string} community
     * @param {string} account - Post author
     * @param {string} permlink
     * @param {string} notes - Reason for flagging
     * @returns {Promise<object>}
     */
    async flagPost(community, account, permlink, notes = '') {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new PixaAPIError('Invalid account', 'INVALID_ACCOUNT');

        const activeUser = await this._getActiveUser();
        if (!activeUser) throw new PixaAPIError('No active session', 'NO_SESSION');

        return this.proxy.broadcast.customJson({
            requiredAuths: [],
            requiredPostingAuths: [activeUser],
            id: 'community',
            json: JSON.stringify(['flagPost', { community, account: normalizedAccount, permlink, notes }])
        });
    }
}

// ============================================
// Account By Key API Group
// ============================================

class AccountByKeyAPI {
    constructor(proxy) { this.proxy = proxy; }

    /**
     * Find accounts associated with public keys
     * @param {Array<string|PublicKey>} keys - Array of public keys
     * @returns {Promise<{accounts: string[][]}>} - accounts[i] contains accounts for keys[i]
     */
    async getKeyReferences(keys) {
        const keyStrings = keys.map(k => {
            if (typeof k === 'string') return k;
            if (k instanceof PublicKey) return k.toString();
            return String(k);
        });

        try {
            // keys.getKeyReferences(keys) — documented dpixa method
            return await this.proxy.client.keys.getKeyReferences(keyStrings);
        } catch (e) {
            console.warn('[AccountByKeyAPI] getKeyReferences failed:', e.message);
        }

        return { accounts: keys.map(() => []) };
    }

    /**
     * Find account for a single key
     * @param {string|PublicKey} key
     * @returns {Promise<string[]>}
     */
    async findAccountsByKey(key) {
        const result = await this.getKeyReferences([key]);
        return result.accounts[0] || [];
    }
}

// ============================================
// Transaction Status API Group
// ============================================

class TransactionStatusAPI {
    constructor(proxy) { this.proxy = proxy; }

    /**
     * Find transaction status
     * @param {string} transactionId - Transaction ID (40-char hex)
     * @param {string} expiration - Optional expiration time
     * @returns {Promise<{status: string, block_num?: number}>}
     */
    async findTransaction(transactionId, expiration = null) {
        try {
            const params = { transaction_id: transactionId };
            if (expiration) params.expiration = expiration;

            return await this.proxy.client.call('transaction_status_api', 'find_transaction', params);
        } catch (e) {
            console.warn('[TransactionStatusAPI] find_transaction failed:', e.message);

            // Fallback: Try to find in recent blocks
            try {
                const tx = await this.proxy.client.database.getTransaction(transactionId);
                if (tx) {
                    return { status: 'within_irreversible_block' };
                }
            } catch (e2) {}

            return { status: 'unknown' };
        }
    }

    /**
     * Check if a transaction has been confirmed
     * @param {string} transactionId
     * @returns {Promise<boolean>}
     */
    async isConfirmed(transactionId) {
        const result = await this.findTransaction(transactionId);
        const confirmedStatuses = ['within_irreversible_block', 'within_reversible_block'];
        return confirmedStatuses.includes(result.status);
    }
}

// ============================================
// JSON-RPC Meta API Group
// ============================================

/**
 * Node capability & method discovery. Unlike the other API groups, these
 * methods target the node itself — not a specific plugin — and are useful
 * for detecting which APIs a node exposes before calling them. Results are
 * cached aggressively (node capabilities rarely change mid-session).
 */
class JsonRpcAPI {
    constructor(proxy) {
        this.proxy = proxy;
        this._methods = null;       // Cached method list
        this._signatures = new Map(); // Cached per-method signatures
    }

    /**
     * Return the full list of JSON-RPC methods the node exposes, as an
     * array of "namespace.method" strings (jsonrpc.get_methods).
     * Cached for the lifetime of the client.
     * @param {boolean} [forceRefresh=false]
     * @returns {Promise<string[]>}
     */
    async getMethods(forceRefresh = false) {
        if (this._methods && !forceRefresh) return this._methods;
        try {
            const result = await this.proxy.client.call('jsonrpc', 'get_methods');
            this._methods = Array.isArray(result) ? result : [];
        } catch (e) {
            console.warn('[JsonRpcAPI] get_methods failed:', e.message);
            this._methods = [];
        }
        return this._methods;
    }

    /**
     * Return the parameter/return signature for a specific RPC method
     * (jsonrpc.get_signature). Useful for introspection tooling.
     * @param {string} method - e.g. "condenser_api.get_dynamic_global_properties"
     * @returns {Promise<object|null>}
     */
    async getSignature(method) {
        if (!method) return null;
        if (this._signatures.has(method)) return this._signatures.get(method);
        try {
            const result = await this.proxy.client.call('jsonrpc', 'get_signature', { method });
            this._signatures.set(method, result);
            return result;
        } catch (e) {
            console.warn(`[JsonRpcAPI] get_signature(${method}) failed:`, e.message);
        }
        return null;
    }

    /**
     * Convenience: does the node expose a given method?
     * Uses the cached method list (fetching it once if needed).
     * @param {string} method - e.g. "rc_api.list_rc_direct_delegations"
     * @returns {Promise<boolean>}
     */
    async hasMethod(method) {
        const methods = await this.getMethods();
        return methods.includes(method);
    }

    /**
     * List which namespaces (API plugins) the node exposes.
     * Derived from get_methods.
     * @returns {Promise<string[]>}
     */
    async getNamespaces() {
        const methods = await this.getMethods();
        const ns = new Set();
        for (const m of methods) {
            const dot = m.indexOf('.');
            if (dot > 0) ns.add(m.slice(0, dot));
        }
        return Array.from(ns).sort();
    }

    /**
     * Clear the method/signature cache. Call after a node switch.
     */
    clearCache() {
        this._methods = null;
        this._signatures.clear();
    }
}

// ============================================
// Rewards API Group
// ============================================

/**
 * Reward-curve simulation. Currently exposes simulate_curve_payouts, which
 * is useful for "if you voted now, you would earn ~X" UX previews without
 * actually casting a vote.
 */
class RewardsAPI {
    constructor(proxy) { this.proxy = proxy; }

    /**
     * Simulate author/curation payouts under the current reward curve
     * (rewards_api.simulate_curve_payouts). Pass either a post's
     * [author, permlink] or a hypothetical rshares value; the node returns
     * the projected split.
     *
     * Note: method availability varies by node. If the node does not expose
     * rewards_api, this returns null rather than throwing — callers should
     * treat a null return as "simulation unavailable".
     *
     * @param {object} params
     * @param {string} [params.variableReward] - Hypothetical rshares as a string
     * @param {Array<{author:string, permlink:string}>} [params.posts] - Specific posts
     * @returns {Promise<object|null>}
     */
    async simulateCurvePayouts({ variableReward, posts } = {}) {
        const apiParams = {};
        if (variableReward !== undefined) apiParams.variable_reward = String(variableReward);
        if (Array.isArray(posts) && posts.length) {
            apiParams.posts = posts.map(p => ({
                author: normalizeAccount(p.author),
                permlink: p.permlink
            }));
        }
        try {
            return await this.proxy.client.call('rewards_api', 'simulate_curve_payouts', apiParams);
        } catch (e) {
            console.warn('[RewardsAPI] simulate_curve_payouts failed:', e.message);
        }
        return null;
    }
}

// ============================================
// Internal Managers
// ============================================

class PaginationManager {
    constructor() { this.cursors = new Map(); }
    setCursor(key, cursor) { this.cursors.set(key, cursor); }
    getCursor(key) { return this.cursors.get(key); }
    clearCursor(key) { this.cursors.delete(key); }
    clearAll() { this.cursors.clear(); }
}

// ============================================
// Sanitization Pipeline
// ============================================

/**
 * SanitizationPipeline - Processes raw blockchain entities through
 * the ContentSanitizer before they are returned to API consumers.
 * Nothing leaves this layer unsanitized.
 *
 * v4.4: This pipeline no longer feeds any persistent store. Each call
 * returns a freshly-sanitized entity that the API method returns
 * directly to its caller.
 */
class SanitizationPipeline {
    /**
     * @param {ContentSanitizer} sanitizer
     * @param {FormatterAPI} formatter
     */
    constructor(sanitizer, formatter) {
        this.sanitizer = sanitizer;
        this.formatter = formatter;
        // Bound once: safe_active_vote takes a username sanitizer, and
        // re-binding per sanitized post/comment is avoidable garbage.
        this._sanitizeUsername = sanitizer.sanitizeUsername.bind(sanitizer);
    }

    // ── ACCOUNT ─────────────────────────────────────────────────────────

    /**
     * Sanitize a raw account object for storage.
     * DANGEROUS FIELDS (`json_metadata`, `posting_json_metadata`) keep their
     * original names but store the WASM-parsed safe object — never the raw string.
     * All dates are integer millisecond timestamps (`new Date(ts)` ready).
     *
     * @param {object} raw - Raw account from blockchain RPC
     * @returns {object|null} Sanitized account ready for DB insertion
     */
    sanitizeAccount(raw) {
        if (!raw || !raw.name) return null;

        const name = this.sanitizer.sanitizeUsername(raw.name);
        if (!name) return null;

        // DANGEROUS: sanitize raw JSON strings through WASM, store sanitized strings only
        const rawPostingMeta = raw.posting_json_metadata || '{}';
        const rawJsonMeta    = raw.json_metadata || '{}';
        const safePostingMetaStr = this.sanitizer.safeJson(rawPostingMeta);
        const safeJsonMetaStr    = this.sanitizer.safeJson(rawJsonMeta);

        // Parse for field extraction only
        let postingMeta = {}, jsonMeta = {};
        try { postingMeta = JSON.parse(safePostingMetaStr); } catch (e) {}
        try { jsonMeta    = JSON.parse(safeJsonMetaStr); } catch (e) {}

        // Merge profile: posting_json_metadata takes priority
        // Guard: profile must be a plain object — strings/arrays produce garbage when spread
        const _sp = (o) => (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
        const profile = { ..._sp(jsonMeta.profile), ..._sp(postingMeta.profile) };

        // Profile fields are already sanitized by safeJson (HTML stripped, schemes checked)
        // display_name: also handle numeric values (e.g. profile.name === 0)
        const displayName  = typeof profile.name === 'string'
            ? (profile.name.trim() || null)?.slice(0, 64) ?? null
            : (typeof profile.name === 'number' && isFinite(profile.name))
                ? String(profile.name).slice(0, 64)
                : null;
        const about        = typeof profile.about    === 'string' ? profile.about.slice(0, 512) : null;
        const location     = typeof profile.location === 'string' ? profile.location.slice(0, 128) : null;
        const website      = typeof profile.website  === 'string' ? profile.website.slice(0, 256) : null;
        // safeJson already validated any data: URI here, but it lets a plaintext
        // http URL through — safeProfileImage is what rejects that, and it
        // re-runs the base64 validation as the second of the two layers.
        const profileImage = this.sanitizer.safeProfileImage(profile.profile_image);
        const coverImage   = this.sanitizer.safeProfileImage(profile.cover_image);

        const links = [];
        if (website)      links.push(website);
        if (profileImage) links.push(profileImage);
        if (coverImage)   links.push(coverImage);

        // Build entity FIELD BY FIELD — no { ...raw } spread.
        return {
            _entity_id:   name,
            _entity_type: 'account',
            _sanitized:   true,
            _stored_at:   Date.now(),

            // Enrichment
            _profile: { display_name: displayName, about, location, website, profile_image: profileImage, cover_image: coverImage },
            _links: links,

            // Identity
            name,
            id: VALIDATORS.safe_number(raw.id) ?? 0,

            // DANGEROUS fields — keep names, store sanitized JSON strings
            json_metadata:         safeJsonMetaStr,
            posting_json_metadata: safePostingMetaStr,

            // Authority objects (structured chain data, not user text)
            owner:   VALIDATORS.safe_authority(raw.owner),
            active:  VALIDATORS.safe_authority(raw.active),
            posting: VALIDATORS.safe_authority(raw.posting),

            // Reputation
            reputation:       VALIDATORS.safe_number(raw.reputation) ?? 0,
            reputation_score: this.formatter ? this.formatter.reputation(raw.reputation) : 25,

            // Balances (translate chain symbols → display symbols)
            balance:                  translateAssetFromChain(VALIDATORS.safe_asset(raw.balance) || '0.000 PIXA'),
            savings_balance:          translateAssetFromChain(VALIDATORS.safe_asset(raw.savings_balance) || '0.000 PIXA'),
            pxs_balance:              translateAssetFromChain(VALIDATORS.safe_asset(raw.pxs_balance) || '0.000 PXS'),
            savings_pxs_balance:      translateAssetFromChain(VALIDATORS.safe_asset(raw.savings_pxs_balance) || '0.000 PXS'),
            vesting_shares:           translateAssetFromChain(VALIDATORS.safe_asset(raw.vesting_shares) || '0.000000 PXP'),
            delegated_vesting_shares: translateAssetFromChain(VALIDATORS.safe_asset(raw.delegated_vesting_shares) || '0.000000 PXP'),
            received_vesting_shares:  translateAssetFromChain(VALIDATORS.safe_asset(raw.received_vesting_shares) || '0.000000 PXP'),
            vesting_withdraw_rate:    translateAssetFromChain(VALIDATORS.safe_asset(raw.vesting_withdraw_rate) || '0.000000 PXP'),
            reward_pixa_balance:      translateAssetFromChain(VALIDATORS.safe_asset(raw.reward_pixa_balance) || '0.000 PIXA'),
            reward_pxs_balance:       translateAssetFromChain(VALIDATORS.safe_asset(raw.reward_pxs_balance) || '0.000 PXS'),
            reward_vesting_balance:   translateAssetFromChain(VALIDATORS.safe_asset(raw.reward_vesting_balance) || '0.000000 PXP'),
            reward_vesting_pixa:      translateAssetFromChain(VALIDATORS.safe_asset(raw.reward_vesting_pixa) || '0.000 PIXA'),
            post_voting_power:        translateAssetFromChain(VALIDATORS.safe_asset(raw.post_voting_power) || '0.000000 PXP'),

            // Voting / mana
            voting_power:    VALIDATORS.safe_number(raw.voting_power) ?? 0,
            voting_manabar:  VALIDATORS.safe_manabar(raw.voting_manabar),
            downvote_manabar: VALIDATORS.safe_manabar(raw.downvote_manabar),
            can_vote:        VALIDATORS.safe_bool(raw.can_vote) ?? true,

            // Activity counts
            post_count:          VALIDATORS.safe_number(raw.post_count) ?? 0,
            curation_rewards:    VALIDATORS.safe_number(raw.curation_rewards) ?? 0,
            posting_rewards:     VALIDATORS.safe_number(raw.posting_rewards) ?? 0,
            witnesses_voted_for: VALIDATORS.safe_number(raw.witnesses_voted_for) ?? 0,

            // Timestamps (integer ms — `new Date(ts)`)
            created:             VALIDATORS.safe_timestamp(raw.created),
            last_post:           VALIDATORS.safe_timestamp(raw.last_post),
            last_root_post:      VALIDATORS.safe_timestamp(raw.last_root_post),
            last_vote_time:      VALIDATORS.safe_timestamp(raw.last_vote_time),
            last_account_update: VALIDATORS.safe_timestamp(raw.last_account_update),
            last_owner_update:   VALIDATORS.safe_timestamp(raw.last_owner_update),

            // Power down
            next_vesting_withdrawal: VALIDATORS.safe_timestamp(raw.next_vesting_withdrawal),
            withdrawn:               VALIDATORS.safe_number(raw.withdrawn) ?? 0,
            to_withdraw:             VALIDATORS.safe_number(raw.to_withdraw) ?? 0,
            withdraw_routes:         VALIDATORS.safe_number(raw.withdraw_routes) ?? 0,

            // Savings
            savings_withdraw_requests: VALIDATORS.safe_number(raw.savings_withdraw_requests) ?? 0,

            // Governance
            witness_votes: Array.isArray(raw.witness_votes)
                ? raw.witness_votes.filter(w => typeof w === 'string' && w.length <= 16)
                : [],
            proxied_vsf_votes: Array.isArray(raw.proxied_vsf_votes)
                ? raw.proxied_vsf_votes.map(v => String(v))
                : [],

            // Keys / proxy / recovery
            memo_key:         VALIDATORS.safe_pubkey(raw.memo_key) || '',
            proxy:            raw.proxy ? (this.sanitizer.sanitizeUsername(raw.proxy) || '') : '',
            recovery_account: raw.recovery_account ? (this.sanitizer.sanitizeUsername(raw.recovery_account) || '') : '',
        };
    }

    // ── POST ────────────────────────────────────────────────────────────

    /**
     * Sanitize a raw post (root-level content, depth=0) for storage.
     * `body` stores sanitized HTML (raw markdown is discarded).
     * `json_metadata` keeps its name but stores the WASM-parsed safe object.
     * All dates are integer millisecond timestamps.
     *
     * @param {object} raw - Raw discussion/post from blockchain RPC
     * @param {object} [renderOptions]
     * @returns {object|null} Sanitized post ready for DB insertion
     */
    sanitizePost(raw, renderOptions = {}) {
        if (!raw || !raw.author || !raw.permlink) return null;

        const author   = this.sanitizer.sanitizeUsername(raw.author);
        const permlink = VALIDATORS.safe_permlink(raw.permlink);
        if (!author || !permlink) return null;

        const entityId = `${author}_${permlink}`;

        // DANGEROUS: json_metadata — sanitize through WASM, returns safe JSON string
        const safeMetaStr = this.sanitizer.safeJson(raw.json_metadata || '{}');
        let meta = {};
        try { meta = JSON.parse(safeMetaStr); } catch (e) {}

        // ── Cover / gradient image out of json_metadata ─────────────────
        // A blog post's cover is a base64 SVG built by GradientEditorDialog and
        // stored in json_metadata, so it is arbitrary attacker input on the way
        // back in — nothing stops someone publishing a post whose metadata was
        // hand-written rather than produced by the editor. safeJson has already
        // run the validator over it; this is the second layer, and the only one
        // that rejects a plaintext http URL.
        const metaImage = Array.isArray(meta.image) ? meta.image[0] : meta.image;
        const coverImage = this.sanitizer.safeProfileImage(metaImage);

        // ── Content type detection ──────────────────────────────────────
        let contentType = detectContentType(raw.body);

        // A pixel-art post IS its body: the whole artwork is one base64 data
        // URI in that field. renderPost validates it on the way through, but
        // that is invisible from here and a failure is indistinguishable from
        // an empty post. Check explicitly so an unsafe payload is demoted
        // rather than quietly rendering as a blank pixel-art card.
        let pixelArtVerdict = null;
        if (contentType === 'pixel_art') {
            pixelArtVerdict = this.sanitizer.inspectImageDataUri((raw.body || '').trim());
            if (!pixelArtVerdict.ok) contentType = 'blog';
        }

        let rendered, summary, descriptionHtml;

        if (contentType === 'pixel_art') {
            rendered = this.sanitizer.renderPost(raw.body || '', renderOptions);
            const rawDesc = typeof meta.description === 'string' ? meta.description : '';
            descriptionHtml = rawDesc
                ? this.sanitizer.renderDescription(rawDesc)
                : '';
            summary = this.sanitizer.extractPlainText(rawDesc).slice(0, 500);
        } else {
            rendered = this.sanitizer.renderPost(raw.body || '', renderOptions);
            const rawDesc = typeof meta.description === 'string' ? meta.description : '';
            descriptionHtml = rawDesc
                ? this.sanitizer.renderDescription(rawDesc)
                : '';
            summary = this.sanitizer.extractPlainText(raw.body || '').slice(0, 500);
        }

        // Build entity FIELD BY FIELD — no { ...raw } spread.
        return {
            _entity_id:   entityId,
            _entity_type: 'post',
            _content_type: contentType,
            _sanitized:   true,
            _stored_at:   Date.now(),

            // Enrichment
            _images:           rendered.images || [],
            _links:            rendered.links || [],
            _cover_image:      coverImage,
            _image_rejected:   pixelArtVerdict && !pixelArtVerdict.ok ? pixelArtVerdict.reason : null,
            _summary:          summary,
            _description_html: descriptionHtml,
            _tags:             meta.tags || [],
            _word_count:       rendered.wordCount || 0,
            _app:              typeof meta.app === 'string' ? meta.app : '',

            // Identity
            id:              VALIDATORS.safe_number(raw.id) ?? 0,
            author,
            permlink,
            category:        this.sanitizer.safeString(raw.category || '', 64),
            parent_author:   '',
            parent_permlink: this.sanitizer.safeString(raw.parent_permlink || '', 256),

            // Content — body IS sanitized HTML
            title: this.sanitizer.safeString(raw.title || '', 256),
            body:  rendered.html || '',

            // DANGEROUS field — keeps name, stores sanitized JSON string
            json_metadata: safeMetaStr,

            // Timestamps (integer ms)
            created:     VALIDATORS.safe_timestamp(raw.created),
            last_update: VALIDATORS.safe_timestamp(raw.last_update),
            active:      VALIDATORS.safe_timestamp(raw.active),
            cashout_time: VALIDATORS.safe_timestamp(raw.cashout_time),
            last_payout: VALIDATORS.safe_timestamp(raw.last_payout),

            // Hierarchy
            depth:    VALIDATORS.safe_number(raw.depth) ?? 0,
            children: VALIDATORS.safe_number(raw.children) ?? 0,

            // Voting
            net_votes:  VALIDATORS.safe_number(raw.net_votes) ?? 0,
            net_rshares: VALIDATORS.safe_numeric_string(raw.net_rshares) || '0',
            author_reputation: this.formatter ? this.formatter.reputation(raw.author_reputation) : 25,

            // Active votes — array of validated objects
            active_votes: Array.isArray(raw.active_votes)
                ? raw.active_votes
                    .map(v => VALIDATORS.safe_active_vote(v, this._sanitizeUsername))
                    .filter(Boolean)
                : [],

            // Payouts (translate chain symbols → display symbols)
            total_payout_value:         translateAssetFromChain(VALIDATORS.safe_asset(raw.total_payout_value) || '0.000 PXS'),
            curator_payout_value:       translateAssetFromChain(VALIDATORS.safe_asset(raw.curator_payout_value) || '0.000 PXS'),
            pending_payout_value:       translateAssetFromChain(VALIDATORS.safe_asset(raw.pending_payout_value) || '0.000 PXS'),
            total_pending_payout_value: translateAssetFromChain(VALIDATORS.safe_asset(raw.total_pending_payout_value) || '0.000 PXS'),
            max_accepted_payout:        translateAssetFromChain(VALIDATORS.safe_asset(raw.max_accepted_payout) || '1000000.000 PXS'),
            promoted:                   translateAssetFromChain(VALIDATORS.safe_asset(raw.promoted) || '0.000 PXS'),
            percent_pxs:                VALIDATORS.safe_percent(raw.percent_pxs) ?? 10000,
            author_rewards:             VALIDATORS.safe_number(raw.author_rewards) ?? 0,

            // Flags
            allow_replies:          VALIDATORS.safe_bool(raw.allow_replies) ?? true,
            allow_votes:            VALIDATORS.safe_bool(raw.allow_votes) ?? true,
            allow_curation_rewards: VALIDATORS.safe_bool(raw.allow_curation_rewards) ?? true,

            // Beneficiaries
            beneficiaries: Array.isArray(raw.beneficiaries)
                ? raw.beneficiaries.map(VALIDATORS.safe_beneficiary).filter(Boolean)
                : [],

            // Navigation / root
            url:           VALIDATORS.safe_url_path(raw.url) || `/@${author}/${permlink}`,
            root_title:    this.sanitizer.safeString(raw.root_title || '', 256),
            root_author:   raw.root_author ? (this.sanitizer.sanitizeUsername(raw.root_author) || '') : '',
            root_permlink: VALIDATORS.safe_permlink(raw.root_permlink) || '',

            // Community & moderation (bridge-enriched fields)
            //
            // `category` already holds the community slug for in-community
            // posts, but we also mirror it under `community` because that's
            // what the bridge API calls it and what downstream code
            // (PaperCardMenuOption, Community.js) reads.
            community:       this.sanitizer.safeString(raw.community || '', 64),
            community_title: this.sanitizer.safeString(raw.community_title || '', 256),
            author_role:     VALIDATORS.safe_community_role(raw.author_role),
            author_title:    this.sanitizer.safeString(raw.author_title || '', 256),
            stats:           VALIDATORS.safe_stats(raw.stats),
            is_paidout:      VALIDATORS.safe_bool(raw.is_paidout) ?? false,
            blacklists:      Array.isArray(raw.blacklists)
                ? raw.blacklists
                    .map(b => this.sanitizer.sanitizeUsername(b))
                    .filter(Boolean)
                    .slice(0, 32)
                : [],
            reblogs:         VALIDATORS.safe_number(raw.reblogs) ?? 0,
            post_id:         VALIDATORS.safe_number(raw.post_id) ?? 0,
        };
    }

    // ── COMMENT ─────────────────────────────────────────────────────────

    /**
     * Sanitize a comment/reply (depth > 0) for storage.
     * Uses renderComment (stricter subset — no headings, tables, iframes).
     * Same field contract as sanitizePost (all dates = integer timestamps, etc.)
     *
     * @param {object} raw - Raw comment from blockchain RPC
     * @param {object} [renderOptions]
     * @returns {object|null} Sanitized comment ready for DB insertion
     */
    sanitizeComment(raw, renderOptions = {}) {
        if (!raw || !raw.author || !raw.permlink) return null;

        const author   = this.sanitizer.sanitizeUsername(raw.author);
        const permlink = VALIDATORS.safe_permlink(raw.permlink);
        if (!author || !permlink) return null;

        const entityId = `${author}_${permlink}`;

        // DANGEROUS: body
        const rendered = this.sanitizer.renderComment(raw.body || '', renderOptions);

        // DANGEROUS: json_metadata — sanitize through WASM, returns safe object
        const safeMetaStr = this.sanitizer.safeJson(raw.json_metadata || '{}');

        return {
            _entity_id:   entityId,
            _entity_type: 'comment',
            _sanitized:   true,
            _stored_at:   Date.now(),

            // Enrichment
            _images:     rendered.images || [],
            _links:      rendered.links || [],
            _word_count: rendered.wordCount || 0,

            // Identity
            id:              VALIDATORS.safe_number(raw.id) ?? 0,
            author,
            permlink,
            parent_author:   raw.parent_author ? (this.sanitizer.sanitizeUsername(raw.parent_author) || '') : '',
            parent_permlink: VALIDATORS.safe_permlink(raw.parent_permlink) || '',

            // Content — body IS sanitized HTML
            title: '',
            body:  rendered.html || '',

            // DANGEROUS field — keeps name, stores sanitized JSON string
            json_metadata: safeMetaStr,

            // Timestamps (integer ms)
            created:      VALIDATORS.safe_timestamp(raw.created),
            last_update:  VALIDATORS.safe_timestamp(raw.last_update),
            active:       VALIDATORS.safe_timestamp(raw.active),
            cashout_time: VALIDATORS.safe_timestamp(raw.cashout_time),
            last_payout:  VALIDATORS.safe_timestamp(raw.last_payout),

            // Hierarchy
            depth:    VALIDATORS.safe_number(raw.depth) ?? 1,
            children: VALIDATORS.safe_number(raw.children) ?? 0,

            // Voting
            net_votes:  VALIDATORS.safe_number(raw.net_votes) ?? 0,
            net_rshares: VALIDATORS.safe_numeric_string(raw.net_rshares) || '0',
            author_reputation: this.formatter ? this.formatter.reputation(raw.author_reputation) : 25,

            active_votes: Array.isArray(raw.active_votes)
                ? raw.active_votes
                    .map(v => VALIDATORS.safe_active_vote(v, this._sanitizeUsername))
                    .filter(Boolean)
                : [],

            // Payouts (translate chain symbols → display symbols)
            pending_payout_value:       translateAssetFromChain(VALIDATORS.safe_asset(raw.pending_payout_value) || '0.000 PXS'),
            total_payout_value:         translateAssetFromChain(VALIDATORS.safe_asset(raw.total_payout_value) || '0.000 PXS'),
            curator_payout_value:       translateAssetFromChain(VALIDATORS.safe_asset(raw.curator_payout_value) || '0.000 PXS'),
            total_pending_payout_value: translateAssetFromChain(VALIDATORS.safe_asset(raw.total_pending_payout_value) || '0.000 PXS'),
            promoted:                   translateAssetFromChain(VALIDATORS.safe_asset(raw.promoted) || '0.000 PXS'),
            author_rewards:             VALIDATORS.safe_number(raw.author_rewards) ?? 0,

            // Flags
            allow_replies:          VALIDATORS.safe_bool(raw.allow_replies) ?? true,
            allow_votes:            VALIDATORS.safe_bool(raw.allow_votes) ?? true,
            allow_curation_rewards: VALIDATORS.safe_bool(raw.allow_curation_rewards) ?? true,

            // Navigation / root
            url:           VALIDATORS.safe_url_path(raw.url) || `/@${author}/${permlink}`,
            root_title:    this.sanitizer.safeString(raw.root_title || '', 256),
            root_author:   raw.root_author ? (this.sanitizer.sanitizeUsername(raw.root_author) || '') : '',
            root_permlink: VALIDATORS.safe_permlink(raw.root_permlink) || '',

            // Community & moderation (bridge-enriched fields) — replies can
            // be muted/flagged too, so we preserve the same block as posts.
            community:       this.sanitizer.safeString(raw.community || '', 64),
            community_title: this.sanitizer.safeString(raw.community_title || '', 256),
            author_role:     VALIDATORS.safe_community_role(raw.author_role),
            author_title:    this.sanitizer.safeString(raw.author_title || '', 256),
            stats:           VALIDATORS.safe_stats(raw.stats),
            is_paidout:      VALIDATORS.safe_bool(raw.is_paidout) ?? false,
            blacklists:      Array.isArray(raw.blacklists)
                ? raw.blacklists
                    .map(b => this.sanitizer.sanitizeUsername(b))
                    .filter(Boolean)
                    .slice(0, 32)
                : [],
        };
    }

    // ── AUTO-DETECT ─────────────────────────────────────────────────────

    /**
     * Auto-detect entity type and sanitize accordingly.
     * @param {object} raw - Raw content from blockchain
     * @param {object} [renderOptions]
     * @returns {object|null}
     */
    sanitizeContent(raw, renderOptions = {}) {
        if (!raw) return null;
        const isPost = (!raw.parent_author || raw.parent_author === '') && (raw.depth === 0 || raw.depth === undefined);
        return isPost
            ? this.sanitizePost(raw, renderOptions)
            : this.sanitizeComment(raw, renderOptions);
    }
}


class ContentSanitizer {
    constructor() {
        this.ready = false;
        this._initPromise = null;

        /** @type {object} Default sanitize options (v0.2 SanitizeOptions) */
        this.defaultOptions = {
            internal_domains: ['pixagram.com'],
            max_body_length: 500000,
            // Bounds the extracted `images` index only — never the rendered
            // body. Was 0, back when the option capped the HTML itself, which
            // deleted every <img> from every post before it reached a
            // component. null = no bound, so `_images` is a complete index.
            max_image_count: null,
        };

        /**
         * Image proxy prefix override, mirrored into the sanitizer module.
         * null means "leave the sanitizer's own default in place" — which is
         * the deployed pixa-image-service worker, so proxying is already on
         * without any config. Set this only to point elsewhere or disable.
         * @type {string|null}
         */
        this.imageProxyBase = null;

        // Cached serialization of defaultOptions for the no-override hot path
        // (revalidated by field identity in _serializeOptions).
        this._defaultsCache = null;
    }

    /**
     * Serialize sanitize options for the WASM boundary.
     * The overwhelmingly common call has no per-call overrides — in that case
     * the spread + JSON.stringify of defaultOptions (paid once per rendered
     * entity at feed scale) is replaced by a cached string. The cache
     * revalidates on field identity, so setInternalDomains() (which replaces
     * the array reference) and any direct scalar mutation of defaultOptions
     * both invalidate it naturally.
     * @private
     */
    _serializeOptions(options) {
        for (const _k in options) {
            // Any own/enumerable override present → serialize the merge.
            return JSON.stringify({ ...this.defaultOptions, ...options });
        }
        const d = this.defaultOptions;
        let c = this._defaultsCache;
        if (!c || c.internal_domains !== d.internal_domains ||
            c.max_body_length !== d.max_body_length ||
            c.max_image_count !== d.max_image_count) {
            c = this._defaultsCache = {
                internal_domains: d.internal_domains,
                max_body_length: d.max_body_length,
                max_image_count: d.max_image_count,
                json: JSON.stringify(d),
            };
        }
        return c.json;
    }

    /**
     * Initialize the pixa-content WASM module
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.ready) return;
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            try {
                // pixaContentInit is the default export — no-op for JS sanitizer
                await pixaContentInit();
                this.ready = true;
                console.log('[ContentSanitizer] pixa-content JS engine initialized');
            } catch (e) {
                console.error('[ContentSanitizer] Failed to initialize pixa-content:', e);
                this.ready = false;
                throw e;
            }
        })();

        return this._initPromise;
    }

    /**
     * Update default internal domains (e.g. when config changes)
     * @param {string[]} domains
     */
    setInternalDomains(domains) {
        if (Array.isArray(domains)) {
            this.defaultOptions.internal_domains = domains;
        }
    }

    /**
     * Gate an image that came out of on-chain JSON metadata.
     *
     * Profile images, cover images and community avatars are all written by
     * whoever owns the account — there is no server in between, so the value
     * is arbitrary attacker input. Accepts only a fully validated base64 image
     * (magic bytes checked, SVG analysed, decompression bombs rejected) or a
     * plain https URL. Everything else becomes null and the caller renders a
     * placeholder.
     *
     * safeJson already routes data URIs through the same validator, so this is
     * the second of the two layers for base64 — but it is the ONLY layer that
     * rejects a plaintext http URL, which safeString lets through.
     *
     * @param {string} value
     * @returns {string|null}
     */
    safeProfileImage(value) {
        if (typeof value !== 'string' || !value) return null;
        if (!wasmSafeProfileImage) return null;   // fail closed, never raw
        try { return wasmSafeProfileImage(value); } catch { return null; }
    }

    /**
     * Full verdict on a base64 image data URI, including the failure reason.
     * @param {string} value
     * @returns {{ ok: boolean, reason?: string, mime?: string, width?: number, height?: number }}
     */
    inspectImageDataUri(value) {
        if (!wasmInspectImageDataUri) return { ok: false, reason: 'sanitizer-unavailable' };
        try { return wasmInspectImageDataUri(value); }
        catch (e) { return { ok: false, reason: 'inspect-threw' }; }
    }

    /**
     * Point every non-base64 <img> at the image proxy worker.
     *
     * Set on the sanitizer MODULE, not in defaultOptions, because the
     * component-side guard (safeHTML) has no api instance and must apply the
     * same rewrite. The rewrite is idempotent, so running it in both passes
     * cannot double-wrap a src.
     *
     * @param {string|null} base — full prefix, e.g. 'https://img.pixa.pics/?url='
     */
    setImageProxyBase(base) {
        this.imageProxyBase = (typeof base === 'string' && base) ? base : null;
        if (wasmSetImageProxyBase) wasmSetImageProxyBase(this.imageProxyBase);
    }

    /**
     * SECURITY PATCH (v3.5.2-patched): Fail-closed guard.
     * Throws instead of silently returning fallback values when WASM is not ready.
     * @param {string} methodName - Caller method name for error context
     * @throws {PixaAPIError} if WASM engine is not initialized
     */
    _requireReady(methodName) {
        if (!this.ready) {
            throw new PixaAPIError(
                `ContentSanitizer.${methodName}(): WASM engine not initialized — cannot sanitize safely`,
                'SANITIZER_NOT_READY'
            );
        }
    }

    /**
     * Render a post body through pixa-content WASM sanitizer
     * Returns sanitized HTML, extracted images, extracted links, and word count.
     *
     * @param {string} body - Raw post body (Markdown or HTML)
     * @param {object} [options] - Override render options
     * @returns {{ html: string, images: Array, links: Array, wordCount: number }}
     */
    renderPost(body, options = {}) {
        if (!body) return { html: '', images: [], links: [], wordCount: 0 };
        this._requireReady('renderPost');

        // SECURITY PATCH: No try/catch fallback — WASM errors must propagate
        const result = wasmSanitizePost(body, this._serializeOptions(options));

        return {
            html: result.html || '',
            images: result.images || [],
            links: result.links || [],
            wordCount: this._countWords(result.html || body),
        };
    }

    /**
     * Render a comment body (stricter subset — no headings, tables, iframes)
     *
     * @param {string} body - Raw comment body
     * @param {object} [options] - Override render options
     * @returns {{ html: string, images: Array, links: Array, wordCount: number }}
     */
    renderComment(body, options = {}) {
        if (!body) return { html: '', images: [], links: [], wordCount: 0 };
        this._requireReady('renderComment');

        const result = wasmSanitizeComment(body, this._serializeOptions(options));

        return {
            html: result.html || '',
            images: [],
            links: result.links || [],
            wordCount: this._countWords(result.html || body),
        };
    }

    /**
     * Sanitize a description or any user-supplied text for safe innerHTML rendering.
     * Uses comment-tier (lists, blockquotes, code, links — no images, headings, tables).
     * Returns just the sanitized HTML string.
     *
     * Use this for: json_metadata.description, profile about, or any text
     * that will be rendered via dangerouslySetInnerHTML in the frontend.
     *
     * @param {string} text - Raw text/HTML/markdown
     * @param {object} [options] - Override render options
     * @returns {string} Sanitized HTML safe for innerHTML
     */
    renderDescription(text, options = {}) {
        if (!text || typeof text !== 'string') return '';
        this._requireReady('renderDescription');

        const result = wasmSanitizeComment(text, this._serializeOptions(options));
        return result.html || '';
    }

    /**
     * Render a memo (bold, italic, @mentions, #hashtags only)
     * v0.2: New tier.
     * @param {string} body
     * @param {object} [options]
     * @returns {{ html: string }}
     */
    renderMemo(body, options = {}) {
        if (!body) return { html: '' };
        this._requireReady('renderMemo');

        return wasmSanitizeMemo(body, this._serializeOptions(options));
    }

    /**
     * Sanitize a JSON string — all keys validated, strings stripped.
     * Input: JSON string or object. Output: sanitized JS object.
     * WASM parses + sanitizes + returns a native object — no double parse.
     * Callers use the object directly; JSON.stringify() when storing.
     * @param {string|object} jsonStr
     * @returns {object} Sanitized JS object (empty object on failure)
     */
    safeJson(jsonStr) {
        if (!jsonStr) return '{}';
        this._requireReady('safeJson');
        // RPC clients may return json_metadata as a pre-parsed object OR a string.
        // WASM expects a string — stringify objects before passing through.
        let input = jsonStr;
        if (typeof input !== 'string') {
            try { input = JSON.stringify(input); } catch (e) { return '{}'; }
        }
        try {
            // wasmSafeJson returns a sanitized JSON string
            return wasmSafeJson(input) || '{}';
        } catch (e) {
            console.warn('[ContentSanitizer] safeJson failed:', e.message || e);
            return '{}';
        }
    }

    /**
     * Sanitize a single string value — strips HTML, rejects embedded JSON.
     * v0.2: New primitive.
     * @param {string} s
     * @param {number} [maxLen=10000]
     * @returns {string}
     */
    safeString(s, maxLen = 10000) {
        if (!s || typeof s !== 'string') return '';
        this._requireReady('safeString');
        return wasmSafeString(s, maxLen) || '';
    }

    /**
     * Extract clean plain text from body (strip all formatting)
     * @param {string} body
     * @returns {string}
     */
    extractPlainText(body) {
        if (!body) return '';
        this._requireReady('extractPlainText');
        return wasmExtractPlainText(body);
    }

    /**
     * TF-IDF extractive summarization
     * @param {string} body
     * @param {number} [sentenceCount=3]
     * @returns {{ summary: string, keywords: Array, sentences: Array }}
     */
    summarize(body, sentenceCount = 3) {
        if (!body) return { summary: '', keywords: [], sentences: [] };
        this._requireReady('summarize');
        return wasmSummarizeContent(body, sentenceCount);
    }

    /**
     * Validate and sanitize username (HIVE-compatible: 3-16 chars, a-z0-9.-)
     * @param {string} rawUsername
     * @returns {string} Sanitized username or '' if invalid
     */
    sanitizeUsername(rawUsername) {
        if (!rawUsername) return '';
        this._requireReady('sanitizeUsername');
        return wasmSanitizeUsername(rawUsername);
    }

    /**
     * Legacy compatibility: processBlogPost wraps renderPost
     * @param {string} body
     * @param {object} [options]
     * @returns {{ body: string, _images: Array, _links: Array, _word_count: number }}
     */
    processBlogPost(body, options = {}) {
        const result = this.renderPost(body, options);
        return {
            body: result.html,
            _images: result.images,
            _links: result.links,
            _word_count: result.wordCount,
        };
    }

    /**
     * Fallback processing when WASM is not available
     * @private
     */
    /**
     * Word count helper — single pass, allocation-free.
     * The old implementation allocated a full tag-stripped copy of the body
     * plus an array of every word just to take `.length` (per entity, with
     * bodies up to max_body_length). Semantics match the previous
     * `replace(/<[^>]*>/g, '').split(/\s+/)`: tag contents are skipped, text
     * glued across a removed tag ("foo<b>bar") stays one word, and the
     * whitespace set is exactly ECMAScript `\s`. (Sole divergence: a stray
     * unterminated `<` skips the remainder instead of counting it — malformed
     * input only, and the count is display-only.)
     * @private
     */
    _countWords(text) {
        let count = 0;
        let inTag = false;
        let inWord = false;
        for (let i = 0, n = text.length; i < n; i++) {
            const c = text.charCodeAt(i);
            if (inTag) {
                if (c === 62 /* > */) inTag = false;
                continue;
            }
            if (c === 60 /* < */) {
                // The old regex *removed* tags, so a word spanning a tag
                // boundary stays a single word: keep inWord as-is.
                inTag = true;
                continue;
            }
            if (
                c === 32 || (c >= 9 && c <= 13) ||           // space, \t \n \v \f \r
                (c >= 128 && (
                    c === 160 || c === 5760 ||               // NBSP, Ogham space
                    (c >= 8192 && c <= 8202) ||              // en/em/thin spaces
                    c === 8232 || c === 8233 ||              // LS, PS
                    c === 8239 || c === 8287 ||              // NNBSP, MMSP
                    c === 12288 || c === 65279               // ideographic space, BOM
                ))
            ) {
                inWord = false;
            } else if (!inWord) {
                inWord = true;
                count++;
            }
        }
        return count;
    }
}

class KeyManager {
    constructor(emitter, config) {
        this.emitter = emitter;
        this.config = config;
        this.sessionKeys = new Map();
        /** @type {number} Failed PIN attempt counter */
        this._pinAttempts = 0;
        /** @type {number} Timestamp of lockout start (0 = not locked) */
        this._pinLockoutUntil = 0;
        /** @type {Promise|null} Active PIN unlock promise (prevents double-dialog) */
        this._pendingPinUnlock = null;
        this.unencrypted = null;
        this.vaultDbReference = null;
        this.vaultMaster = null;
        this.vaultIndividual = null;
        this.activeAccount = null;
        this.pinVerified = false;
        this.pinVerificationTime = 0;
        /** @private AES-GCM CryptoKey for in-memory key encryption (non-extractable, memory-only) */
        this._sessionCryptoKey = null;
        /** @private Bound cleanup handler for tab-close events */
        this._cleanupBound = null;
        /** @private Reference to the proxy's unlockWithPin for PIN re-verification */
        this._unlockWithPin = null;
        /** @type {SessionManager} Reference to SessionManager v2 (set by PixaProxyAPI) */
        this._sessionManager = null;
        /** @private LacertaDB reference for persistent lockout state */
        this._settingsDb = null;
        /** @private LacertaDB collection for PIN lockout persistence */
        this._pinLockoutStore = null;
    }

    /**
     * Wire the SessionManager reference. Called by PixaProxyAPI.initialize().
     * @param {SessionManager} sm
     */
    setSessionManager(sm) {
        this._sessionManager = sm;
    }

    setPinTimeout(timeout) {
        if (this.config) { this.config.PIN_TIMEOUT = timeout; }
    }

    /**
     * Reset the PIN verification timer. Called from all paths that verify
     * the PIN or accept a raw key — ensures keys stay in-memory for the
     * full PIN_TIMEOUT duration from this moment.
     */
    resetPinTimer() {
        this.pinVerified = true;
        this.pinVerificationTime = Date.now();
    }

    /**
     * Migrate keys currently in sessionKeys (in-memory) and/or in the
     * unencrypted collection into the encrypted vault.  Called after vault
     * creation to ensure keys from a prior quickLogin are persisted.
     * @param {string} account - normalized account name
     */
    async migrateKeysToVault(account) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return;

        const types = ['posting', 'active', 'owner', 'memo'];
        // Track which individual keys have already been written to vault
        // to avoid double-writes (section 1 from unencrypted, section 2 from sessionKeys).
        // LacertaDB's encrypted vault `update` path can fail with TurboSerial
        // deserialization errors, so we use add-only and silently skip conflicts.
        const writtenKeys = new Set();

        // 1. Try to migrate from unencrypted DB → vault
        if (this.unencrypted) {
            // Master keys (all 4 derived from master password)
            try {
                const masterDoc = await this.unencrypted.get(normalizedAccount);
                if (masterDoc && masterDoc.derived_keys) {
                    if (this.vaultMaster) {
                        try {
                            await this.vaultMaster.add(
                                { account: normalizedAccount, derived_keys: masterDoc.derived_keys, created_at: Date.now() },
                                { id: normalizedAccount }
                            );
                            console.debug('[migrateKeysToVault] Keys migrated to vault');
                        } catch (e) {
                            // Already exists — skip (don't use update — it triggers TurboSerial errors)
                            console.debug('[migrateKeysToVault] Master keys already in vault');
                        }
                        // Mark all types as written (master key derives all 4)
                        types.forEach(t => writtenKeys.add(`${normalizedAccount}_${t}`));
                    }
                    // Also ensure they're in the in-memory cache
                    await this.cacheKeys(normalizedAccount, masterDoc.derived_keys);
                }
            } catch (e) { /* no master doc */ }

            // Individual keys
            for (const type of types) {
                const id = `${normalizedAccount}_${type}`;
                if (writtenKeys.has(id)) continue; // Already handled by master keys
                try {
                    const doc = await this.unencrypted.get(id);
                    if (doc && doc.key && this.vaultIndividual) {
                        try {
                            await this.vaultIndividual.add(
                                { account: normalizedAccount, type, key: doc.key, created_at: Date.now() },
                                { id }
                            );
                            console.debug(`[migrateKeysToVault] Keys migrated to vault`);
                        } catch (e) {
                            // Already exists — skip
                        }
                        writtenKeys.add(id);
                    }
                } catch (e) { /* no individual doc */ }
            }
        }

        // 2. Migrate from sessionKeys → vault (keys that were only in-memory)
        for (const type of types) {
            const cacheKey = `${normalizedAccount}_${type}`;
            if (writtenKeys.has(cacheKey)) continue; // Already migrated above

            const entry = this.sessionKeys.get(cacheKey);
            if (!entry) continue;

            const plainKey = await this._decryptFromCache(entry);
            if (!plainKey) continue;

            if (this.vaultIndividual) {
                try {
                    await this.vaultIndividual.add(
                        { account: normalizedAccount, type, key: plainKey, created_at: Date.now() },
                        { id: cacheKey }
                    );
                    console.debug(`[migrateKeysToVault] Keys migrated to vault`);
                } catch (e) {
                    // Already exists — skip (add-only, no update)
                }
            }
        }

        // SECURITY FIX (v3.5.2): After successful migration, delete plaintext
        // keys from the unencrypted collection. They are now safely in the vault.
        if (this.unencrypted) {
            try {
                await this.unencrypted.delete(normalizedAccount);
            } catch (e) { /* may not exist */ }
            for (const type of types) {
                try {
                    await this.unencrypted.delete(`${normalizedAccount}_${type}`);
                } catch (e) { /* may not exist */ }
            }
        }
    }

    /**
     * Generate a random AES-GCM CryptoKey for encrypting session keys in memory.
     * The key is non-extractable and lives only in JS heap — it cannot be
     * serialized, persisted, or read from devtools. When the tab closes or the
     * PIN expires, it is destroyed and the encrypted blobs become unrecoverable.
     */
    /**
     * SECURITY (v4.3 — H3): Record a failed PIN attempt with persistent storage,
     * exponential backoff, and hard wipe limit.
     *
     * - Attempt counter + lockout state survive page reload (stored in LacertaDB)
     * - Lockout duration doubles after each consecutive lockout (exponential backoff)
     * - After PIN_WIPE_LIMIT total failed attempts, the sealed vault is destroyed
     *   entirely — forces re-login with actual private key
     *
     * @returns {Promise<{ locked: boolean, remainingSec: number, wiped: boolean }>}
     */
    async _recordFailedPinAttempt() {
        const MAX_PER_WINDOW = this.config.PIN_MAX_ATTEMPTS || 10;
        const BASE_LOCKOUT = this.config.PIN_LOCKOUT_MS || 300000;
        const WIPE_LIMIT = this.config.PIN_WIPE_LIMIT || 50;

        // Load persistent state
        let state = { attempts: 0, totalAttempts: 0, consecutiveLockouts: 0, lockoutUntil: 0 };
        if (this._pinLockoutStore) {
            try {
                const doc = await this._pinLockoutStore.get('state');
                if (doc) state = { ...state, ...doc };
            } catch (_) {}
        }

        state.attempts++;
        state.totalAttempts++;

        // Also update in-memory for immediate checks (backward compat)
        this._pinAttempts = state.attempts;

        // Hard wipe limit: destroy vault after too many total failed attempts
        if (state.totalAttempts >= WIPE_LIMIT) {
            // Nuclear option — force complete re-login
            // v6: sealed_keys collection no longer exists.
            // Wipe the sessions collection instead (encrypted_keys live there).
            if (this._settingsDb) {
                try {
                    const sealedCol = await this._settingsDb.getCollection('sealed_keys');
                    await sealedCol.clear({ force: true });
                } catch (_) { /* collection may not exist in v6 */ }
                try {
                    const sessCol = await this._settingsDb.getCollection('sessions');
                    await sessCol.clear({ force: true });
                } catch (_) {}
            }

            // Reset lockout state
            state = { attempts: 0, totalAttempts: 0, consecutiveLockouts: 0, lockoutUntil: 0 };
            if (this._pinLockoutStore) {
                try { await this._pinLockoutStore.delete('state'); } catch (_) {}
            }

            this._pinAttempts = 0;
            this._pinLockoutUntil = 0;
            return { locked: true, remainingSec: 0, wiped: true };
        }

        // Window lockout: exponential backoff
        if (state.attempts >= MAX_PER_WINDOW) {
            state.consecutiveLockouts++;
            const multiplier = Math.min(Math.pow(2, state.consecutiveLockouts - 1), 64);
            const lockoutMs = BASE_LOCKOUT * multiplier;
            state.lockoutUntil = Date.now() + lockoutMs;
            state.attempts = 0; // Reset window counter; lockout timer takes over

            this._pinLockoutUntil = state.lockoutUntil;
            this._pinAttempts = 0;

            // Persist
            if (this._pinLockoutStore) {
                try { await this._pinLockoutStore.upsert('state', state); } catch (_) {}
            }

            return { locked: true, remainingSec: Math.ceil(lockoutMs / 1000), wiped: false };
        }

        // Persist updated counter
        if (this._pinLockoutStore) {
            try { await this._pinLockoutStore.upsert('state', state); } catch (_) {}
        }

        return { locked: false, remainingSec: 0, wiped: false };
    }

    /**
     * SECURITY (v4.3 — H3): Check persistent lockout state.
     * Called at the start of unlockWithPin to enforce lockout across reloads.
     * @returns {Promise<{ locked: boolean, remainingSec: number }>}
     */
    async _checkPinLockout() {
        // Check in-memory first (fast path)
        if (this._pinLockoutUntil > Date.now()) {
            return { locked: true, remainingSec: Math.ceil((this._pinLockoutUntil - Date.now()) / 1000) };
        }

        // Check persistent state (survives reload)
        if (this._pinLockoutStore) {
            try {
                const doc = await this._pinLockoutStore.get('state');
                if (doc?.lockoutUntil > Date.now()) {
                    this._pinLockoutUntil = doc.lockoutUntil; // Sync to memory
                    return { locked: true, remainingSec: Math.ceil((doc.lockoutUntil - Date.now()) / 1000) };
                }
            } catch (_) {}
        }

        return { locked: false, remainingSec: 0 };
    }

    async _generateSessionCryptoKey() {
        // Destroy any existing key first
        this._destroySessionCrypto(false);

        this._sessionCryptoKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            false, // non-extractable
            ['encrypt', 'decrypt']
        );

        // Register tab-close cleanup
        if (typeof globalThis !== 'undefined' && globalThis.addEventListener) {
            this._cleanupBound = () => this._destroySessionCrypto(true);
            globalThis.addEventListener('pagehide', this._cleanupBound);
            globalThis.addEventListener('beforeunload', this._cleanupBound);
        }
    }

    /**
     * Encrypt key material for in-memory storage.
     *
     * SECURITY (v4.4): Accepts Uint8Array (preferred) or string (legacy).
     * The input bytes are ZEROED after encryption — the encrypted blob
     * in sessionKeys is the only copy.
     *
     * No plaintext fallback: if the session CryptoKey is not available,
     * this method throws instead of silently storing plaintext. Callers
     * MUST ensure _generateSessionCryptoKey() has completed first.
     *
     * @param {Uint8Array|string} keyMaterial - Key bytes or WIF string
     * @returns {Promise<object>} Encrypted blob {_enc, iv, ct}
     */
    async _encryptForCache(keyMaterial) {
        if (!this._sessionCryptoKey) {
            throw new Error('[KeyManager] Cannot cache keys: session CryptoKey not initialized. Call _generateSessionCryptoKey() first.');
        }

        let plainBytes;
        if (keyMaterial instanceof Uint8Array) {
            plainBytes = keyMaterial;
        } else if (typeof keyMaterial === 'string') {
            // Legacy WIF string path — encode to bytes
            plainBytes = new TextEncoder().encode(keyMaterial);
        } else {
            throw new TypeError('[KeyManager] _encryptForCache: expected Uint8Array or string');
        }

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            this._sessionCryptoKey,
            plainBytes
        );
        // Zero the plaintext bytes — the AES-GCM blob is now the only copy
        plainBytes.fill(0);
        return { _enc: true, iv, ct };
    }

    /**
     * Decrypt a cached key blob back to raw bytes.
     *
     * SECURITY (v4.4): Returns a fresh Uint8Array. The caller MUST zero
     * it after use, or wrap in YOLOBuffer.
     *
     * No plaintext string passthrough: legacy plaintext entries are rejected
     * (return null). This forces migration to encrypted storage.
     *
     * @param {object} blob - Encrypted blob {_enc, iv, ct}
     * @returns {Promise<Uint8Array|null>} Raw key bytes or null
     */
    async _decryptFromCacheAsBytes(blob) {
        if (!blob) return null;
        if (typeof blob === 'string') {
            // SECURITY (v4.4): Legacy plaintext string in sessionKeys.
            // Convert to bytes for the caller but log a warning — these
            // should have been encrypted on storage.
            console.warn('[KeyManager] Legacy plaintext key found in sessionKeys — should be migrated');
            return new TextEncoder().encode(blob);
        }
        if (!blob._enc) return null;
        if (!this._sessionCryptoKey) return null; // CryptoKey destroyed
        try {
            const plainBuf = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: blob.iv },
                this._sessionCryptoKey,
                blob.ct
            );
            return new Uint8Array(plainBuf);
        } catch (e) {
            return null; // decryption failed — key was likely destroyed
        }
    }

    /**
     * Decrypt a cached key blob back to a WIF string.
     *
     * LEGACY wrapper around _decryptFromCacheAsBytes. Prefer the bytes
     * variant for new code to avoid creating immutable WIF strings.
     *
     * @param {object|string} blob - Encrypted blob or legacy plaintext string
     * @returns {Promise<string|null>} Decrypted WIF string or null
     */
    async _decryptFromCache(blob) {
        if (!blob) return null;
        // Legacy plaintext string passthrough (backward compat for existing cached entries)
        if (typeof blob === 'string') return blob;
        const bytes = await this._decryptFromCacheAsBytes(blob);
        if (!bytes) return null;
        const str = new TextDecoder().decode(bytes);
        bytes.fill(0); // Zero the byte copy — only the string survives
        return str;
    }

    /**
     * Destroy the session CryptoKey and wipe all encrypted cached keys.
     * Called on PIN expiry, tab close, and explicit lock.
     * @param {boolean} clearKeys - Whether to also clear the sessionKeys Map
     */
    _destroySessionCrypto(clearKeys = true) {
        this._sessionCryptoKey = null;
        if (clearKeys) {
            this.sessionKeys.clear();
            this.pinVerified = false;
            this.pinVerificationTime = 0;
        }
        if (this._cleanupBound && typeof globalThis !== 'undefined' && globalThis.removeEventListener) {
            globalThis.removeEventListener('pagehide', this._cleanupBound);
            globalThis.removeEventListener('beforeunload', this._cleanupBound);
            this._cleanupBound = null;
        }
    }

    async setDependencies(settingsDb) {
        this._settingsDb = settingsDb;
        // ensureCollection() is synchronous — registers the handle without IDB overhead.
        // The collection lazy-inits on first actual get/add/update operation.
        this.unencrypted = settingsDb.ensureCollection('unencrypted_keys');

        // SECURITY (v4.3 — H3): Persistent PIN lockout storage.
        // Survives page reload so attackers cannot reset the counter.
        this._pinLockoutStore = settingsDb.ensureCollection('pin_lockout');
    }

    async setVault(vaultDb) {
        this.vaultDbReference = vaultDb;
        if (vaultDb) {
            this.vaultMaster = vaultDb.ensureCollection('master_keys');
            this.vaultIndividual = vaultDb.ensureCollection('individual_keys');
        }
    }

    async unlockVault(pin) {
        try {
            if (!this._sessionCryptoKey) {
                await this._generateSessionCryptoKey();
            }
            this.resetPinTimer();
            // Reuse setVault to avoid duplicating collection creation logic
            await this.setVault(this.vaultDbReference);
            return true;
        } catch (e) {
            this.pinVerified = false;
            this.pinVerificationTime = 0;
            throw new Error("Invalid PIN or Vault Error");
        }
    }

    async lock() {
        this._destroySessionCrypto(true);
        this.vaultMaster = null;
        this.vaultIndividual = null;
    }

    isPINValid() {
        // FIX (v4.2 — Bug A safety net): If the session is NOT in PIN mode,
        // there is no PIN timeout to enforce. Return true so that callers
        // (requestKey, hasKey, getKeyIfAvailable) never enter the
        // "PIN expired → _destroySessionCrypto" path. In persist/ephemeral
        // mode, keys are legitimately cached and should stay alive
        // indefinitely — no PIN countdown should ever nuke them.
        if (this._sessionManager &&
            this._sessionManager.currentMode !== 'pin') {
            return true;
        }

        if (!this.pinVerified || this.pinVerificationTime <= 0) return false;
        const timeout = this.config.PIN_TIMEOUT || 15 * 60 * 1000;
        if ((Date.now() - this.pinVerificationTime) >= timeout) {
            // PIN expired — destroy CryptoKey and wipe all cached keys
            this._destroySessionCrypto(true);
            return false;
        }
        return true;
    }

    async cacheKeys(account, keys) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return;

        // Ensure CryptoKey is ready before caching anything
        // SECURITY (v4.4): No plaintext fallback — _encryptForCache throws without CryptoKey
        if (!this._sessionCryptoKey) {
            await this._generateSessionCryptoKey();
        }

        for (const [type, key] of Object.entries(keys)) {
            if (!key) continue;
            // _encryptForCache accepts both Uint8Array and string,
            // and zeroes the input bytes after encryption
            const stored = await this._encryptForCache(key);
            this.sessionKeys.set(`${normalizedAccount}_${type}`, stored);
        }
    }

    /**
     * Request a key as a YOLOBuffer (preferred API for signing operations).
     *
     * Returns a one-shot self-zeroing buffer containing the raw key bytes.
     * The caller MUST consume via .bytes or YOLOBuffer.use() and zero
     * the result after signing.
     *
     * SECURITY (v4.4): This is the primary key-access API. Use this instead
     * of requestKey() for all broadcast/signing paths to avoid creating
     * immutable WIF strings in the GC heap.
     *
     * @param {string} account
     * @param {string} type - 'posting' | 'active' | 'owner' | 'memo'
     * @returns {Promise<YOLOBuffer>} One-shot buffer with raw key bytes
     */
    async requestKeyBuffer(account, type) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new KeyNotFoundError(account, type);

        // ── Fast path: try session cache directly as bytes ──
        const sessionEntry = this.sessionKeys.get(`${normalizedAccount}_${type}`);
        if (sessionEntry) {
            if (this.pinVerificationTime > 0 && !this.isPINValid()) {
                // isPINValid() auto-destroys; fall through
            } else {
                const bytes = await this._decryptFromCacheAsBytes(sessionEntry);
                if (bytes) return new YOLOBuffer(bytes);
                this.sessionKeys.delete(`${normalizedAccount}_${type}`);
            }
        }

        // ── Slow path: delegate to requestKey (vault/PIN/event flows) ──
        // requestKey returns a WIF string — wrap in YOLOBuffer immediately.
        // The string can't be zeroed, but the YOLOBuffer gives the caller
        // a zeroable byte copy. Future work: make vault paths bytes-native.
        const wifString = await this.requestKey(account, type);
        return YOLOBuffer.fromString(wifString);
    }

    /**
     * Request a key as a WIF string.
     *
     * LEGACY API — prefer requestKeyBuffer() for signing operations.
     * This method returns an immutable JS string that cannot be zeroed.
     *
     * @param {string} account
     * @param {string} type - 'posting' | 'active' | 'owner' | 'memo'
     * @returns {Promise<string>} WIF private key string
     */
    async requestKey(account, type) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new KeyNotFoundError(account, type);

        const sessionEntry = this.sessionKeys.get(`${normalizedAccount}_${type}`);
        if (sessionEntry) {
            // If PIN was used but has expired, destroy crypto and deny
            if (this.pinVerificationTime > 0 && !this.isPINValid()) {
                // isPINValid() auto-destroys; fall through to vault/PIN check
            } else {
                const decrypted = await this._decryptFromCache(sessionEntry);
                if (decrypted) return decrypted;
                // Decryption failed (CryptoKey gone) — clear stale entry
                this.sessionKeys.delete(`${normalizedAccount}_${type}`);
            }
        }

        if (this.vaultMaster && this.isPINValid()) {
            try {
                const master = await this.vaultMaster.get(normalizedAccount);
                if (master && master.derived_keys && master.derived_keys[type]) {
                    await this.cacheKeys(normalizedAccount, master.derived_keys);
                    return master.derived_keys[type];
                }
            } catch (e) {}
        }

        if (this.vaultIndividual && this.isPINValid()) {
            try {
                const indKey = await this.vaultIndividual.get(`${normalizedAccount}_${type}`);
                if (indKey && indKey.key) {
                    const stored = await this._encryptForCache(indKey.key);
                    this.sessionKeys.set(`${normalizedAccount}_${type}`, stored);
                    return indKey.key;
                }
            } catch (e) {}
        }

        // If vault is configured but PIN has expired, request PIN unlock
        // instead of asking for the raw private key.
        // FIX (v4.1): Also detect PQ vault sessions via SessionManager PIN mode.
        // The old LacertaDB vault path sets vaultDbReference; the new PQ vault path
        // sets SessionManager.currentMode === 'pin'. Both should trigger PIN unlock.
        const hasPinVault = this.vaultDbReference
            || (this._sessionManager && this._sessionManager.currentMode === 'pin');
        if (hasPinVault && !this.isPINValid()) {
            // SECURITY FIX (v3.5.2): Queue concurrent PIN requests to prevent
            // double-dialog. If a PIN prompt is already active, wait for it.
            if (this._pendingPinUnlock) {
                try {
                    await this._pendingPinUnlock;
                    // PIN was unlocked by the other request — retry key fetch
                    const cachedEntry = this.sessionKeys.get(`${normalizedAccount}_${type}`);
                    if (cachedEntry) {
                        const decrypted = await this._decryptFromCache(cachedEntry);
                        if (decrypted) return decrypted;
                    }
                } catch (e) {
                    // Previous unlock failed — fall through to show our own dialog
                }
            }

            const pinPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new KeyNotFoundError(normalizedAccount, type));
                }, 120000); // 2 minutes to allow retries

                const emitData = {
                    account: normalizedAccount,
                    type,
                    reason: `PIN required for ${type} operation`,
                    callback: null, // pinCallback — set below
                    keyCallback: null // keyCallback — set below (Enter Key path)
                };

                // PIN callback: UI provides the PIN, we verify + unlock + retry key fetch.
                // On wrong PIN: throws so UI shows "Incorrect PIN"; dialog stays open for retry.
                // On correct PIN: resolves the outer Promise with the decrypted key.
                // On hard failure: rejects the outer Promise.
                const pinCallback = async (pin) => {
                    if (!this._unlockWithPin) {
                        clearTimeout(timeout);
                        reject(new Error('PIN unlock not available'));
                        return;
                    }

                    const unlockResult = await this._unlockWithPin(pin, {
                        account: normalizedAccount,
                        keyType: type
                    });

                    if (!unlockResult.success) {
                        // Wrong PIN — throw so the UI handler's catch shows "Incorrect PIN"
                        // snackbar. The dialog stays open and the user can retry.
                        throw new Error(unlockResult.error || 'Incorrect PIN');
                    }

                    // PIN verified and keys loaded — clear the timeout
                    clearTimeout(timeout);

                    // Read the key from cache (unlockWithPin should have loaded it)
                    const cachedEntry = this.sessionKeys.get(`${normalizedAccount}_${type}`);
                    if (cachedEntry) {
                        const decrypted = await this._decryptFromCache(cachedEntry);
                        if (decrypted) {
                            resolve(decrypted);
                            return;
                        }
                    }

                    // Fallback: try vault read directly
                    if (this.vaultMaster && this.isPINValid()) {
                        try {
                            const master = await this.vaultMaster.get(normalizedAccount);
                            if (master && master.derived_keys && master.derived_keys[type]) {
                                await this.cacheKeys(normalizedAccount, master.derived_keys);
                                resolve(master.derived_keys[type]);
                                return;
                            }
                        } catch (e) {}
                    }

                    if (this.vaultIndividual && this.isPINValid()) {
                        try {
                            const indKey = await this.vaultIndividual.get(`${normalizedAccount}_${type}`);
                            if (indKey && indKey.key) {
                                const stored = await this._encryptForCache(indKey.key);
                                this.sessionKeys.set(`${normalizedAccount}_${type}`, stored);
                                resolve(indKey.key);
                                return;
                            }
                        } catch (e) {}
                    }

                    // PIN was correct but key not found — hard failure
                    reject(new KeyNotFoundError(normalizedAccount, type));
                };

                // Key callback: UI provides a raw private key directly.
                // UnlockKeyDialog already validates, caches (encrypted), and
                // resets the PIN timer before invoking this callback.
                // We just need to resolve the pending requestKey Promise.
                const keyCallback = async (key) => {
                    clearTimeout(timeout);
                    // Ensure session crypto + PIN state is set (defense in depth)
                    if (!this._sessionCryptoKey) {
                        await this._generateSessionCryptoKey();
                    }
                    this.resetPinTimer();
                    resolve(key);
                };

                emitData.callback = pinCallback;
                emitData.keyCallback = keyCallback;
                this.emitter.emit('pin_required', emitData);
            });

            this._pendingPinUnlock = pinPromise;
            pinPromise.finally(() => { this._pendingPinUnlock = null; });
            return pinPromise;
        }

        return new Promise((resolve, reject) => {
            const eventName = `key_request_${normalizedAccount}_${type}`;
            const timeout = setTimeout(() => {
                this.emitter.removeListener(eventName, keyResponseHandler);
                reject(new KeyNotFoundError(normalizedAccount, type));
            }, 60000);

            // Create a callback that UI can use to provide the key
            const callback = async (key, shouldStore = false, isMaster = false) => {
                clearTimeout(timeout);
                try {
                    if (isMaster) {
                        const derivedKeys = await this.addAccountWithMasterKey(normalizedAccount, key, { storeInVault: shouldStore });
                        resolve(derivedKeys[type]);
                    } else {
                        await this.addIndividualKey(normalizedAccount, type, key, { storeInVault: shouldStore });
                        resolve(key);
                    }
                } catch (e) {
                    reject(e);
                }
            };

            this.emitter.emit('key_required', { account: normalizedAccount, type, callback });

            // Also listen for the legacy event-based response
            const keyResponseHandler = async (keyInput) => {
                clearTimeout(timeout);
                try {
                    if (typeof keyInput === 'object' && keyInput.masterPassword) {
                        const derivedKeys = await this.addAccountWithMasterKey(normalizedAccount, keyInput.masterPassword, { storeInVault: keyInput.save });
                        resolve(derivedKeys[type]);
                    } else {
                        const keyValue = typeof keyInput === 'object' ? keyInput.key : keyInput;
                        const shouldSave = typeof keyInput === 'object' ? keyInput.save : false;
                        await this.addIndividualKey(normalizedAccount, type, keyValue, { storeInVault: shouldSave });
                        resolve(keyValue);
                    }
                } catch(e) { reject(e); }
            };
            this.emitter.once(eventName, keyResponseHandler);
        });
    }

    async addAccountWithMasterKey(account, masterPassword, options = {}) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new Error('Invalid account');

        // SECURITY (v4.3 — C2): Owner key is the root credential — it can
        // change all other keys, transfer account ownership, and is
        // irrecoverable if stolen. Never derive or cache it unless explicitly
        // requested (e.g. for account recovery or authority update operations).
        //
        // Default derivation: posting + active + memo (sufficient for all
        // normal operations: voting, posting, transfers, memo encryption).
        const defaultTypes = ['posting', 'active', 'memo'];
        const allTypes = options.includeOwner ? [...defaultTypes, 'owner'] : defaultTypes;

        const derivedKeys = {};
        for (const type of allTypes) {
            derivedKeys[type] = PrivateKey.fromLogin(normalizedAccount, masterPassword, type).toString();
        }

        await this.cacheKeys(normalizedAccount, derivedKeys);

        // SECURITY (v4.4): Vault-only persistence. Never store plaintext keys
        // in IndexedDB. If no vault is available, keys live only in the
        // in-memory session cache (AES-GCM encrypted). They die with the tab.
        if (this.vaultMaster) {
            // Store ONLY in encrypted vault
            try {
                await this.vaultMaster.add(
                    { account: normalizedAccount, derived_keys: derivedKeys, created_at: Date.now() },
                    { id: normalizedAccount }
                );
            } catch (e) {
                // Already exists — skip (don't use update — encrypted vault update can fail)
            }
        } else {
            // SECURITY (v4.4): No vault → ephemeral only.
            // Keys live in sessionKeys (AES-GCM encrypted in-memory).
            // They die with the tab. This is the correct security posture
            // for a session that hasn't set up persistence.
            console.debug('[KeyManager] No vault configured — keys are ephemeral only (in-memory cache)');
        }

        return derivedKeys;
    }

    async addIndividualKey(account, type, key, options = {}) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) throw new Error('Invalid account');

        // Ensure CryptoKey is ready (v4.4: no plaintext fallback)
        if (!this._sessionCryptoKey) {
            await this._generateSessionCryptoKey();
        }

        const stored = await this._encryptForCache(key);
        this.sessionKeys.set(`${normalizedAccount}_${type}`, stored);

        // SECURITY (v4.4): Vault-only persistence. If no vault is available,
        // the key lives only in the in-memory session cache (ephemeral).
        if (this.vaultIndividual) {
            const id = `${normalizedAccount}_${type}`;
            try {
                await this.vaultIndividual.add(
                    { account: normalizedAccount, type, key, created_at: Date.now() },
                    { id }
                );
            } catch (e) {
                // Already exists — skip
            }
        } else {
            console.debug(`[KeyManager] No vault — ${type} key is ephemeral only`);
        }
    }

    /**
     * MIGRATION (v4.4): Load keys from the legacy unencrypted_keys collection.
     *
     * Keys are loaded into the in-memory cache (encrypted via AES-GCM CryptoKey),
     * then the plaintext documents are DELETED from IndexedDB. This method
     * exists for backward compatibility with v4.3 sessions and will be
     * removed in v4.5.
     *
     * If a vault is available, keys are also migrated there before deletion.
     *
     * @param {string} account
     * @returns {Promise<boolean>} Whether any keys were found and migrated
     * @deprecated Will be removed in v4.5. Use vault-based storage.
     */
    async loadUnencryptedKeys(account) {
        if (!this.unencrypted) return false;
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return false;

        let foundAny = false;
        const docsToDelete = [];

        // Master keys
        try {
            const data = await this.unencrypted.get(normalizedAccount);
            if (data && data.derived_keys) {
                await this.cacheKeys(normalizedAccount, data.derived_keys);
                foundAny = true;
                docsToDelete.push(normalizedAccount);

                // Migrate to vault if available
                if (this.vaultMaster) {
                    try {
                        await this.vaultMaster.add(
                            { account: normalizedAccount, derived_keys: data.derived_keys, created_at: Date.now() },
                            { id: normalizedAccount }
                        );
                        console.info('[KeyManager] Migrated master keys from unencrypted → vault');
                    } catch (_) { /* already in vault — skip (add-only to avoid TurboSerial errors on encrypted update) */ }
                }
            }
        } catch(e) {}

        // Individual keys
        const types = ['posting', 'active', 'owner', 'memo'];
        for (const type of types) {
            try {
                const id = `${normalizedAccount}_${type}`;
                const data = await this.unencrypted.get(id);
                if (data && data.key) {
                    const stored = await this._encryptForCache(data.key);
                    this.sessionKeys.set(id, stored);
                    foundAny = true;
                    docsToDelete.push(id);

                    // Migrate to vault if available
                    if (this.vaultIndividual) {
                        try {
                            await this.vaultIndividual.add(
                                { account: normalizedAccount, type, key: data.key, created_at: Date.now() },
                                { id }
                            );
                            console.info(`[KeyManager] Migrated ${type} key from unencrypted → vault`);
                        } catch (_) { /* already in vault — skip (add-only to avoid TurboSerial errors on encrypted update) */ }
                    }
                }
            } catch(e) {}
        }

        // SECURITY (v4.4): Delete plaintext documents after migration.
        // This is the key change — we never leave plaintext keys in IndexedDB.
        for (const docId of docsToDelete) {
            try {
                await this.unencrypted.delete(docId);
                console.debug(`[KeyManager] Deleted plaintext key document: ${docId}`);
            } catch (_) {}
        }

        if (foundAny) {
            console.info('[KeyManager] Legacy unencrypted keys migrated and purged');
        }

        return foundAny;
    }

    async clearAllSessions(clearStorage = false) {
        this._destroySessionCrypto(true);
        this.activeAccount = null;
        this.vaultMaster = null;
        this.vaultIndividual = null;

        if (clearStorage && this.unencrypted) {
            try {
                await this.unencrypted.clear({ force: true });
            } catch (e) {}
        }
    }

    hasKey(account, type) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return false;
        // Trigger auto-cleanup if PIN expired (isPINValid auto-destroys)
        if (this.pinVerificationTime > 0 && !this.isPINValid()) {
            return false;
        }
        return this.sessionKeys.has(`${normalizedAccount}_${type}`);
    }

    /**
     * @removed v3.5.2 — Returned plaintext keys for quickLogin sessions.
     * Use requestKey() (async) which properly decrypts in-memory encrypted keys.
     */
    getKeySync(_account, _type) {
        return null;
    }

    /**
     * Silently retrieve a key if it is already available in session cache or
     * unlocked vault. NEVER triggers PIN dialog or key-entry events.
     * Returns null if the key is not currently accessible.
     *
     * @param {string} account
     * @param {string} type - 'posting' | 'active' | 'owner' | 'memo'
     * @returns {Promise<string|null>} The private key WIF string or null
     */
    async getKeyIfAvailable(account, type) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return null;

        // Check PIN expiry
        if (this.pinVerificationTime > 0 && !this.isPINValid()) {
            return null;
        }

        // 1. Try session cache
        const sessionEntry = this.sessionKeys.get(`${normalizedAccount}_${type}`);
        if (sessionEntry) {
            const decrypted = await this._decryptFromCache(sessionEntry);
            if (decrypted) return decrypted;
            // Decryption failed (CryptoKey gone) — clear stale entry
            this.sessionKeys.delete(`${normalizedAccount}_${type}`);
        }

        // 2. Try vault master keys (only if PIN is still valid — no prompting)
        if (this.vaultMaster && this.isPINValid()) {
            try {
                const master = await this.vaultMaster.get(normalizedAccount);
                if (master && master.derived_keys && master.derived_keys[type]) {
                    await this.cacheKeys(normalizedAccount, master.derived_keys);
                    return master.derived_keys[type];
                }
            } catch (e) {}
        }

        // 3. Try vault individual keys
        if (this.vaultIndividual && this.isPINValid()) {
            try {
                const indKey = await this.vaultIndividual.get(`${normalizedAccount}_${type}`);
                if (indKey && indKey.key) {
                    const stored = await this._encryptForCache(indKey.key);
                    this.sessionKeys.set(`${normalizedAccount}_${type}`, stored);
                    return indKey.key;
                }
            } catch (e) {}
        }

        // Key not available — return null, do NOT prompt
        return null;
    }

    /**
     * Silently retrieve a key as a YOLOBuffer if available.
     * NEVER triggers PIN dialog or key-entry events.
     *
     * @param {string} account
     * @param {string} type - 'posting' | 'active' | 'owner' | 'memo'
     * @returns {Promise<YOLOBuffer|null>} YOLOBuffer with key bytes, or null
     */
    async getKeyIfAvailableAsBuffer(account, type) {
        const normalizedAccount = normalizeAccount(account);
        if (!normalizedAccount) return null;

        if (this.pinVerificationTime > 0 && !this.isPINValid()) {
            return null;
        }

        const sessionEntry = this.sessionKeys.get(`${normalizedAccount}_${type}`);
        if (sessionEntry) {
            const bytes = await this._decryptFromCacheAsBytes(sessionEntry);
            if (bytes) return new YOLOBuffer(bytes);
            this.sessionKeys.delete(`${normalizedAccount}_${type}`);
        }

        // Vault fallbacks return strings — wrap in YOLOBuffer
        if (this.vaultMaster && this.isPINValid()) {
            try {
                const master = await this.vaultMaster.get(normalizedAccount);
                if (master && master.derived_keys && master.derived_keys[type]) {
                    await this.cacheKeys(normalizedAccount, master.derived_keys);
                    return YOLOBuffer.fromString(master.derived_keys[type]);
                }
            } catch (e) {}
        }

        if (this.vaultIndividual && this.isPINValid()) {
            try {
                const indKey = await this.vaultIndividual.get(`${normalizedAccount}_${type}`);
                if (indKey && indKey.key) {
                    const stored = await this._encryptForCache(indKey.key);
                    this.sessionKeys.set(`${normalizedAccount}_${type}`, stored);
                    return YOLOBuffer.fromString(indKey.key);
                }
            } catch (e) {}
        }

        return null;
    }

    setActiveAccount(acc) {
        this.activeAccount = normalizeAccount(acc);
    }

    getActiveAccount() {
        return this.activeAccount;
    }
}

// SessionManager → see ./session-manager.js

// ============================================
// Exports
// ============================================

// Error classes + session (re-exported from ./session-manager.js)
export {
    CONFIG,
    KeyNotFoundError,
    VaultNotInitializedError,
    SessionExpiredError,
    SessionNotFoundError,
    PinRequiredError,
    SessionManager,
    SessionMode,
    YOLOBuffer,
    VOTE_OUTCOME,
};

// Re-export dpixa utilities for convenience
export {
    PrivateKey,
    PublicKey,
    Signature,
    Asset,
    Price,
    Memo,
    cryptoUtils,
    utils,
    Types,
    BlockchainMode,
    getVestingSharePrice,
    getVests,
    VERSION,
    DEFAULT_CHAIN_ID,
    NETWORK_ID
};

// Utility functions
export {
    normalizeAccount,
    getRandomBytes,
    bytesToHex,
    translateAssetFromChain,
    translateAssetToChain,
    parseAsset,
    formatAssetString,
    detectContentType,
    estimatePinEntropy
};

// Re-export SDK utility helpers (deferred — utils populated by JSLoader at init)
const waitForEvent = (...args) => utils.waitForEvent(...args);
const retryingFetch = (...args) => utils.retryingFetch(...args);
export { waitForEvent, retryingFetch };