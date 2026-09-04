import {createBrowserHistory} from "history";
export const HISTORY = createBrowserHistory();
export const LANGUAGES = ["en", "fr", "id", "pt", "it", "de", "ja", "zh", "ko", "ru", "hi", "es"];

/*
 * The page routes system is working with regex, tabs system (weird) isn't great but it will change
 */
export const PAGE_ROUTES = [
    {
        page_regex: /^\/$/,
        page_name: "home",
        tabs: ""
    },
    {
        page_regex: /^\/(portal-[0-9]+)(\/(created|hot|trending|promoted))?(\/editor)?\/?$/,
        page_name: "community",
        tabs: ""
    },
    {
        page_regex: /^\/(created|hot|trending|promoted)(\/[a-z\-]+)?\/?$/,
        page_name: "feed",
        tabs: ""
    },
    {
        page_regex: /((^\/feed\/@[0-9a-z\.\-]+(\/)?)|(^\/feed(\/)?))$/,
        page_name: "feedpersonal",
        tabs: ""
    },
    {
        page_regex: /^\/@([a-z0-9\.\-]+)(\/(posts|comments|replies|history))?(\/(followers|following|wallet)(\/(overview|power|pixa|supra|history))?)?/,
        page_name: "profile",
        tabs: ""
    },
    {
        page_regex: /^\/([a-z0-9\-]+)\/@([a-z0-9\.\-]+)\/([a-z0-9\.\-]+)\/?$/,
        page_name: "post",
        tabs: ""
    },
    {
        page_regex: /^\/*/,
        page_name: "unknown",
        tabs: ""
    }
];

// We use this to know which currency to select when we have the country code known
export const CURRENCY_COUNTRIES = {
    ARS: ["AR"],
    AUD: ["AU", "CC", "CX", "HM", "KI", "NF", "NR", "TV"],
    BDT: ["BD"],
    BRL: ["BR"],
    CAD: ["CA"],
    CHF: ["CH", "LI"],
    CLP: ["CL"],
    CNY: ["CN"],
    COP: ["CO"],
    CZK: ["CZ"],
    DKK: ["DK", "FO", "GL"],
    EUR: ["AD", "AT", "AX", "BE", "BL", "CY", "DE", "EE", "ES", "FI", "FR", "GF", "GP", "GR", "IE", "IT", "LU", "MC", "ME", "MF", "MQ", "MT", "NL", "PM", "PT", "RE", "SI", "SK", "SM", "TF", "VA", "YT"],
    GBP: ["GB", "GG", "GS", "IM", "JE"],
    HKD: ["HK"],
    HUF: ["HU"],
    IDR: ["ID"],
    ILS: ["IL", "PS"],
    INR: ["IN"],
    JPY: ["JP"],
    KRW: ["KR"],
    LKR: ["LK"],
    MXN: ["MX"],
    NOK: ["BV", "NO", "SJ"],
    NZD: ["CK", "NU", "NZ", "PN", "TK"],
    PLN: ["PL"],
    RON: ["RO"],
    RUB: ["RU"],
    SAR: ["SA"],
    SEK: ["SE"],
    THB: ["TH"],
    TRY: ["TR"],
    TWD: ["TW"],
    USD: ["AS", "BQ", "EC", "FM", "GU", "IO", "MH", "MP", "PR", "PW", "TC", "TL", "UM", "US", "VG", "VI"],
    ZAR: ["ZA"],
};

// `network` marks which chain a node points at: "mainnet" for the real
// (pre-)production chain, "testnet" for the test chain. This drives node
// preference in settings.js's first-run auto-selection — mainnet nodes are
// preferred outright, regardless of ping time, so a new visitor is never
// silently auto-picked onto the testnet just because it answered faster.
export const DEFAULT_NODES = [
    {
        id: "eu-central",
        name: "Pixa Rex (Frankfurt)",
        url: "https://api.pixagram.com",
        location: [50.1109, 8.6821],  // Frankfurt — central Europe (DE-CIX)
        network: "mainnet",
    },
    {
        id: "sg-central",
        name: "Merlion Surf (Singapore)",
        url: "https://merlion.surf",
        location: [1.3521, 103.81998],  // Pays-Bas — central Europe (DE-CIX)
        network: "mainnet",
    },
];

// Sentinel `api_node` value meaning "use the user-supplied URL in
// settings.api_node_custom_url" instead of one of the entries above. Kept
// here (rather than inlined as a string) so settings.js, Index.js, and
// SettingsDialog.js can't drift out of sync on the literal.
export const CUSTOM_API_NODE_ID = "custom";

// Display currencies offered in Settings. Codes are a subset of
// CURRENCY_COUNTRIES (so locale-detection can preselect one) and every one
// resolves on frankfurter.dev. `symbol` is for compact display; the wallet and
// cards print the ISO code (e.g. "12.34 CHF") to stay unambiguous across the
// many currencies that share "$", "kr" or "¥".
export const CURRENCIES = [
    { code: "ARS", name: "Argentine Peso",      symbol: "$"   },
    { code: "AUD", name: "Australian Dollar",   symbol: "A$"  },
    { code: "BDT", name: "Bangladeshi Taka",    symbol: "৳"   },
    { code: "BRL", name: "Brazilian Real",      symbol: "R$"  },
    { code: "CAD", name: "Canadian Dollar",     symbol: "CA$" },
    { code: "CHF", name: "Swiss Franc",         symbol: "CHF" },
    { code: "CLP", name: "Chilean Peso",        symbol: "$"   },
    { code: "CNY", name: "Chinese Yuan",        symbol: "¥"   },
    { code: "COP", name: "Colombian Peso",      symbol: "$"   },
    { code: "CZK", name: "Czech Koruna",        symbol: "Kč"  },
    { code: "DKK", name: "Danish Krone",        symbol: "kr"  },
    { code: "EUR", name: "Euro",                symbol: "€"   },
    { code: "GBP", name: "British Pound",       symbol: "£"   },
    { code: "HKD", name: "Hong Kong Dollar",    symbol: "HK$" },
    { code: "HUF", name: "Hungarian Forint",    symbol: "Ft"  },
    { code: "IDR", name: "Indonesian Rupiah",   symbol: "Rp"  },
    { code: "ILS", name: "Israeli New Shekel",  symbol: "₪"   },
    { code: "INR", name: "Indian Rupee",        symbol: "₹"   },
    { code: "JPY", name: "Japanese Yen",        symbol: "¥"   },
    { code: "KRW", name: "South Korean Won",    symbol: "₩"   },
    { code: "LKR", name: "Sri Lankan Rupee",    symbol: "Rs"  },
    { code: "MXN", name: "Mexican Peso",        symbol: "$"   },
    { code: "NOK", name: "Norwegian Krone",     symbol: "kr"  },
    { code: "NZD", name: "New Zealand Dollar",  symbol: "NZ$" },
    { code: "PLN", name: "Polish Złoty",        symbol: "zł"  },
    { code: "RON", name: "Romanian Leu",        symbol: "lei" },
    { code: "RUB", name: "Russian Ruble",       symbol: "₽"   },
    { code: "SAR", name: "Saudi Riyal",         symbol: "﷼"   },
    { code: "SEK", name: "Swedish Krona",       symbol: "kr"  },
    { code: "THB", name: "Thai Baht",           symbol: "฿"   },
    { code: "TRY", name: "Turkish Lira",        symbol: "₺"   },
    { code: "TWD", name: "New Taiwan Dollar",   symbol: "NT$" },
    { code: "USD", name: "US Dollar",           symbol: "$"   },
    { code: "ZAR", name: "South African Rand",  symbol: "R"   },
];

// Quick { CODE: "symbol" } lookup derived from CURRENCIES.
export const CURRENCY_SYMBOLS = CURRENCIES.reduce((acc, c) => {
    acc[c.code] = c.symbol;
    return acc;
}, {});

export const FIRST_WEEK_DAY_BY_COUNTRY = {
    "001": "mon",
    "AD": "mon",
    "AE": "sat",
    "AF": "sat",
    "AG": "sun",
    "AI": "mon",
    "AL": "mon",
    "AM": "mon",
    "AN": "mon",
    "AR": "mon",
    "AS": "sun",
    "AT": "mon",
    "AU": "sun",
    "AX": "mon",
    "AZ": "mon",
    "BA": "mon",
    "BD": "sun",
    "BE": "mon",
    "BG": "mon",
    "BH": "sat",
    "BM": "mon",
    "BN": "mon",
    "BR": "sun",
    "BS": "sun",
    "BT": "sun",
    "BW": "sun",
    "BY": "mon",
    "BZ": "sun",
    "CA": "sun",
    "CH": "mon",
    "CL": "mon",
    "CM": "mon",
    "CN": "sun",
    "CO": "sun",
    "CR": "mon",
    "CY": "mon",
    "CZ": "mon",
    "DE": "mon",
    "DJ": "sat",
    "DK": "mon",
    "DM": "sun",
    "DO": "sun",
    "DZ": "sat",
    "EC": "mon",
    "EE": "mon",
    "EG": "sat",
    "ES": "mon",
    "ET": "sun",
    "FI": "mon",
    "FJ": "mon",
    "FO": "mon",
    "FR": "mon",
    "GB": "mon",
    "GB-alt-variant": "sun",
    "GE": "mon",
    "GF": "mon",
    "GP": "mon",
    "GR": "mon",
    "GT": "sun",
    "GU": "sun",
    "HK": "sun",
    "HN": "sun",
    "HR": "mon",
    "HU": "mon",
    "ID": "sun",
    "IE": "mon",
    "IL": "sun",
    "IN": "sun",
    "IQ": "sat",
    "IR": "sat",
    "IS": "mon",
    "IT": "mon",
    "JM": "sun",
    "JO": "sat",
    "JP": "sun",
    "KE": "sun",
    "KG": "mon",
    "KH": "sun",
    "KR": "sun",
    "KW": "sat",
    "KZ": "mon",
    "LA": "sun",
    "LB": "mon",
    "LI": "mon",
    "LK": "mon",
    "LT": "mon",
    "LU": "mon",
    "LV": "mon",
    "LY": "sat",
    "MC": "mon",
    "MD": "mon",
    "ME": "mon",
    "MH": "sun",
    "MK": "mon",
    "MM": "sun",
    "MN": "mon",
    "MO": "sun",
    "MQ": "mon",
    "MT": "sun",
    "MV": "fri",
    "MX": "sun",
    "MY": "mon",
    "MZ": "sun",
    "NI": "sun",
    "NL": "mon",
    "NO": "mon",
    "NP": "sun",
    "NZ": "mon",
    "OM": "sat",
    "PA": "sun",
    "PE": "sun",
    "PH": "sun",
    "PK": "sun",
    "PL": "mon",
    "PR": "sun",
    "PT": "sun",
    "PY": "sun",
    "QA": "sat",
    "RE": "mon",
    "RO": "mon",
    "RS": "mon",
    "RU": "mon",
    "SA": "sun",
    "SD": "sat",
    "SE": "mon",
    "SG": "sun",
    "SI": "mon",
    "SK": "mon",
    "SM": "mon",
    "SV": "sun",
    "SY": "sat",
    "TH": "sun",
    "TJ": "mon",
    "TM": "mon",
    "TR": "mon",
    "TT": "sun",
    "TW": "sun",
    "UA": "mon",
    "UM": "sun",
    "US": "sun",
    "UY": "mon",
    "UZ": "mon",
    "VA": "mon",
    "VE": "sun",
    "VI": "sun",
    "VN": "mon",
    "WS": "sun",
    "XK": "mon",
    "YE": "sun",
    "ZA": "sun",
    "ZW": "sun"
};

export const UTC_OFFSET_PER_COUNTRIES = {
    "AF": 4.3,
    "AL": 2,
    "DZ": 2,
    "AS": -11,
    "AO": 1,
    "AI": -4,
    "AG": -4,
    "AR": -3,
    "AM": 4,
    "AW": -4,
    "AU": 10,
    "AT": 1,
    "AZ": 4,
    "BS": -5,
    "BH": 3,
    "BD": 6,
    "BB": -4,
    "BY": 3,
    "BE": 1,
    "BZ": -6,
    "BJ": 1,
    "BM": -4,
    "BT": 6,
    "BO": -4,
    "BA": 1,
    "BW": 2,
    "BR": -5,
    "BG": 2,
    "BF": 0,
    "BI": 2,
    "KH": 7,
    "CM": 1,
    "CA": -6,
    "CV": -1,
    "KY": -5,
    "CF": 1,
    "TD": 1,
    "CL": -3,
    "CN": 8,
    "CX": 7,
    "CC": 6.3,
    "CO": -5,
    "KM": 3,
    "CD": 1,
    "CK": -10,
    "CR": -6,
    "CI": 0,
    "HR": 1,
    "CY": 2,
    "CZ": 1,
    "DK": 1,
    "DJ": 3,
    "DM": -4,
    "DO": -4,
    "EC": -5,
    "EG": 2,
    "SV": -6,
    "GQ": 1,
    "ER": 3,
    "EE": 2,
    "ET": 3,
    "FK": -3,
    "FO": 0,
    "FJ": 12,
    "FI": 2,
    "FR": 1,
    "GF": -3,
    "PF": -10,
    "GA": 1,
    "GM": 0,
    "GE": 4,
    "DE": 1,
    "GH": 0,
    "GI": 1,
    "GR": 2,
    "GL": -3,
    "GD": -4,
    "GP": -4,
    "GU": 10,
    "GT": -6,
    "GG": 0,
    "GN": 0,
    "GW": 0,
    "GY": -4,
    "HT": -5,
    "HM": 5,
    "VA": 1,
    "HN": -6,
    "HK": 8,
    "HU": 1,
    "IS": 0,
    "IN": 5.3,
    "ID": 7,
    "IR": 3.3,
    "IQ": 3,
    "IE": 0,
    "IM": 0,
    "IL": 2,
    "IT": 1,
    "JM": -5,
    "JP": 9,
    "JE": 0,
    "JO": 2,
    "KZ": 5,
    "KE": 3,
    "KI": 12,
    "KP": 8.3,
    "KR": 9,
    "KW": 3,
    "KG": 6,
    "LA": 7,
    "LV": 2,
    "LB": 2,
    "LS": 2,
    "LR": 0,
    "LI": 1,
    "LT": 2,
    "LU": 1,
    "MK": 1,
    "MG": 3,
    "MW": 2,
    "MY": 8,
    "MV": 5,
    "ML": 0,
    "MT": 0,
    "MH": 12,
    "MQ": -4,
    "MR": 0,
    "MU": 4,
    "YT": 3,
    "MX": -6,
    "FM": 10,
    "MD": 2,
    "MC": 1,
    "MN": 8,
    "MS": -4,
    "MA": 0,
    "MZ": 2,
    "MM": 6.3,
    "NA": 1,
    "NR": 12,
    "NP": 5.45,
    "NL": 1,
    "AN": -4,
    "NZ": 12,
    "NI": -6,
    "NE": 1,
    "NG": 1,
    "NU": -11,
    "NF": 11.3,
    "MP": 10,
    "NO": 1,
    "OM": 4,
    "PK": 5,
    "PW": 9,
    "PS": 2,
    "PA": -5,
    "PG": 10,
    "PY": -4,
    "PE": -5,
    "PH": 8,
    "PL": 1,
    "PT": 0,
    "PR": -4,
    "QA": 3,
    "RE": 4,
    "RU": 0,
    "RW": 2,
    "SH": 0,
    "KN": -4,
    "LC": -4,
    "PM": -3,
    "VC": -4,
    "WS": 13,
    "SM": 1,
    "ST": 0,
    "SA": 3,
    "SN": 0,
    "SC": 4,
    "SL": 0,
    "SG": 8,
    "SK": 1,
    "SI": 1,
    "SB": 11,
    "SO": 3,
    "ZA": 2,
    "GS": -2,
    "ES": 1,
    "LK": 5.3,
    "SD": 3,
    "SR": -3,
    "SJ": 1,
    "SZ": 2,
    "SE": 1,
    "CH": 1,
    "SY": 2,
    "TW": 8,
    "TJ": 5,
    "TZ": 3,
    "TH": 7,
    "TG": 0,
    "TK": 13,
    "TO": 13,
    "TT": 13,
    "TN": 1,
    "TR": 2,
    "TM": 5,
    "TV": 12,
    "UG": 3,
    "UA": 2,
    "AE": 4,
    "GB": 0,
    "US": -6,
    "UY": -3,
    "UZ": 5,
    "VU": 11,
    "VE": -4.3,
    "VN": 7,
    "VG": -4,
    "VI": -4,
    "WF": 12,
    "EH": 1,
    "YE": 3,
    "ZM": 1,
    "ZW": 2,
    "AX": 2,
    "AD": 1,
    "AQ": 13,
    "BV": 1,
    "IO": 6,
    "BN": 8,
    "CG": 1,
    "CU": -5,
    "TF": 5,
    "XK": 1,
    "LY": 2,
    "MO": 8,
    "NC": 11,
    "PN": -8,
    "RO": 2,
    "RS": 1,
    "ME": 1,
    "TL": 9,
    "TC": -5,
    "UM": -11
}

// ── Official governance portals ────────────────────────────────────────
// The on-chain communities that back the governance layer. `id` is the
// community's account name on the chain — the URL segment (`/portal-000001`)
// and the category a post carries — while `name` is the stable in-app key
// the components use to attach their own icon, label and description (the
// display copy is deliberately NOT here: it is per-view and gets
// translated). The ids are canonical, reserved at genesis. Every place that
// names a portal — the drawer menu (MenuContent), the governance dialog
// (GDDisruptions, GDVMProposals) and the post editor
// (LexicalTextEditorDialog) — reads from here, so a literal `portal-…` id
// never lives in a component again and the files cannot drift apart.
export const PROPOSALS_PORTAL = Object.freeze({ name: "proposals", id: "portal-000000" });

// The eight topical portals, in display order: the drawer's governance grid
// and the Disruptions grid render exactly this sequence, after the
// proposals row.
export const COMMUNITY_PORTALS = Object.freeze([
    Object.freeze({ name: "discussions", id: "portal-000001" }),
    Object.freeze({ name: "governance",  id: "portal-000002" }),
    Object.freeze({ name: "marketing",   id: "portal-000003" }),
    Object.freeze({ name: "legal",       id: "portal-000004" }),
    Object.freeze({ name: "risks",       id: "portal-000005" }),
    Object.freeze({ name: "security",    id: "portal-000006" }),
    Object.freeze({ name: "bugs",        id: "portal-000007" }),
    Object.freeze({ name: "community",   id: "portal-000008" }),
]);

// ── Post overlay URL helpers ──────────────────────────────────────────
export const POST_URL_REGEX = /^\/([a-z0-9\-]+)\/@([a-z0-9\.\-]+)\/([a-z0-9\.\-]+)\/?$/;
export const COMMUNITY_TAG_REGEX = /^portal-[0-9]+$/;

export function isPostUrl(pathname) {
    return POST_URL_REGEX.test(pathname || "");
}

export function parsePostUrl(pathname) {
    const m = (pathname || "").match(POST_URL_REGEX);
    return m ? { tag: m[1], author: m[2], permlink: m[3] } : null;
}

// True when the post URL lives inside a community (category is `portal-N`).
// Community posts render via <Community> + <BlogPostDialog>; all others render
// via <Feed>/<FeedPersonal>/<Profile> + <PostDialog>.
export function isCommunityPostUrl(pathname) {
    const p = parsePostUrl(pathname);
    return !!(p && COMMUNITY_TAG_REGEX.test(p.tag));
}

// The page that should host a given post URL as an overlay. Used by the
// router to decide which page component to mount when deep-linking straight
// to a post URL, and to decide whether a current page can overlay a newly
// pushed post URL without being unmounted.
export function hostPageForPostUrl(pathname) {
    return isCommunityPostUrl(pathname) ? "community" : "feed";
}

export function buildPostUrl(data) {
    if (!data) return null;
    const category = (data.category || (data.tags && data.tags[0]) || "general").replace(/[^a-z0-9\-]/g, "");
    const author = ((data.author || {}).username || "").replace(/[^a-z0-9\.\-]/g, "");
    const permlink = (data.permlink || "").replace(/[^a-z0-9\.\-]/g, "");
    if (!author || !permlink) return null;
    return "/" + category + "/@" + author + "/" + permlink;
}

// ── Deleted / unavailable posts ────────────────────────────────────────
// Pixagram deletes by SOFT delete: `json_metadata.deleted = true` — never a
// tag, since tags are browsable and a deleted post must not stay enumerable
// through a tag page (see EditPostDialog / DeletePostDialog). Pixel-art posts
// additionally get their body wiped to the literal string "deleted", because a
// post carrying votes can never be removed from the chain with delete_comment.
// A few legacy posts were flagged with a `deleted` tag instead, so both shapes
// are honoured on read. This is the union of what the page-level copies used to
// do separately: Feed / FeedPersonal / Profile each carried a byte-identical
// private isDeletedPost that read RAW chain posts (_tags + json_metadata.tags),
// while the dialogs need the ENRICHED card shape (the `deleted` boolean the
// enrichment already resolved). One definition now covers both, which is the
// point — three private copies of the same predicate is how they drift.
//
// Every feed / community / profile listing filters flagged posts out, which is
// exactly why a deleted post only ever reaches a full view through a direct
// link, the browser history or a stored favorite: those are the three paths
// that resolve a post BY URL instead of picking it out of an already-filtered
// list. Without this helper the dialogs open onto an empty shell.
export function isDeletedPost(data) {
    if (!data) return false;
    if (data._deleted === true || data.deleted === true) return true;
    const tags = data._tags || data.tags || [];
    if (Array.isArray(tags) && tags.some(t => typeof t === "string" && t.toLowerCase() === "deleted")) return true;
    let meta = null;
    try {
        meta = typeof data.json_metadata === "string"
            ? JSON.parse(data.json_metadata || "{}")
            : (data.json_metadata || {});
    } catch { meta = null; }
    if (!meta) return false;
    if (meta.deleted === true || meta.deleted === "true" || meta.deleted === 1) return true;
    // Raw chain posts haven't been hydrated yet, so their tags still live in
    // json_metadata rather than _tags.
    const metaTags = Array.isArray(meta.tags) ? meta.tags : [];
    return metaTags.some(t => typeof t === "string" && t.toLowerCase() === "deleted");
}

// The four states a full-view dialog can be handed. Host pages open the dialog
// immediately with a stub built from the URL so the transition isn't gated on
// the network round-trip, then hydrate it — so a dialog can never assume it
// always holds a post.
//
//   READY     — hydrated post, render normally
//   LOADING   — orphan fetch still in flight (stub from the URL)
//   DELETED   — soft-deleted by its author, or gone from the chain
//   NOT_FOUND — fetch failed, api never came up, or the link is wrong
export const POST_STATE = Object.freeze({
    READY: "ready",
    LOADING: "loading",
    DELETED: "deleted",
    NOT_FOUND: "not_found",
});

// DELETED is checked before LOADING on purpose: a stub never carries the
// deleted flag, so the only way both are set is a hydrated-then-restubbed
// post, where "deleted" is the truthful answer.
export function getPostState(data) {
    const d = data || {};
    if (isDeletedPost(d)) return POST_STATE.DELETED;
    if (d._notFound === true) return POST_STATE.NOT_FOUND;
    if (d._loading === true) return POST_STATE.LOADING;
    return POST_STATE.READY;
}

// ── Post-dialog drawer ↔ URL-hash mapping ──────────────────────────────
// The PostDialog (and BlogPostDialog, should it adopt the same scheme)
// mirrors its drawer state in the URL hash so deep-links and the browser
// back arrow work naturally:
//
//   /…/permlink         → drawer closed (mobile only — on desktop the
//                         drawer is always visible and the URL is kept
//                         in sync with `#info` etc.)
//   /…/permlink#info    → drawer open at tab 0 (details)
//   /…/permlink#replies → drawer open at tab 1 (comments)
//   /…/permlink#nft     → drawer open at tab 2 (NFT)
//
// `POST_DRAWER_TAB_HASHES` is index-keyed; `POST_DRAWER_HASH_TABS` is the
// reverse for parsing. Tab 3 (the programmatic VotesView) is intentionally
// not represented — it isn't reachable from the tabs strip and we don't
// want it as a shareable deep-link target.
export const POST_DRAWER_TAB_HASHES = { 0: "#info", 1: "#replies", 2: "#nft" };
export const POST_DRAWER_HASH_TABS  = { info: 0, replies: 1, nft: 2 };

// Parse a URL hash (with or without the leading `#`) into a drawer tab
// index. Returns null for empty / unknown hashes so callers can cleanly
// distinguish "no drawer hash" from "drawer hash for tab 0".
export function parsePostDrawerHash(rawHash) {
    // A drawer hash may carry extra `&key=value` params after the tab name
    // (e.g. "#replies&focus=<b64>") — only the leading segment names the tab.
    const h = (rawHash || "").replace(/^#/, "").split("&")[0];
    const idx = POST_DRAWER_HASH_TABS[h];
    return idx === undefined ? null : idx;
}

// ── Comment focus deep-links ───────────────────────────────────────────
// "#replies&focus=<b64url>" opens a post's thread with one comment pinned
// in its hover state and the tree path down to it brightened (PostDialog
// parses it; BlogPostDialog can adopt the same param). The payload is
// base64url("author/permlink"): account names and permlinks are plain
// [a-z0-9.-], so "/" is an unambiguous separator, and the alphabet swap
// (+ → -, / → _, padding stripped) keeps the value URL-safe.
export function buildCommentFocusHash(author, permlink, tabHash) {
    const base = tabHash || POST_DRAWER_TAB_HASHES[1];
    const a = String(author || "").replace(/^@/, "");
    const p = String(permlink || "");
    if (!a || !p || typeof btoa !== "function") return base;
    let b64 = "";
    try { b64 = btoa(a + "/" + p).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
    catch (e) { return base; }
    return base + "&focus=" + b64;
}

export function parseCommentFocusHash(rawHash) {
    const h = (rawHash || "").replace(/^#/, "");
    const part = h.split("&").find((s) => s.indexOf("focus=") === 0);
    if (!part || typeof atob !== "function") return null;
    let raw = part.slice(6).replace(/-/g, "+").replace(/_/g, "/");
    while (raw.length % 4) raw += "=";
    let decoded = "";
    try { decoded = atob(raw); } catch (e) { return null; }
    const i = decoded.indexOf("/");
    if (i <= 0 || i >= decoded.length - 1) return null;
    return { author: decoded.slice(0, i), permlink: decoded.slice(i + 1) };
}