import * as React from "preact/compat";
import timeAgo from '../utils/TimeAgo';
import { NumericFormat } from 'react-number-format';

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Checkbox from '@material-ui/core/Checkbox';
import TextField from "@material-ui/core/TextField";
import ButtonBase from "@material-ui/core/ButtonBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import Skeleton from "@material-ui/lab/Skeleton";
import { cssBackgroundImage } from "../utils/safeUrl";

import { T } from "../utils/T";
import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({
    dialogContent: {
        padding: "24px"
    },
    sectionTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        fontFamily: "'Industry Book'",
        marginBottom: "8px"
    },
    sectionDescription: {
        fontSize: "14px",
        color: "#888",
        fontFamily: "'Normative Pro'",
        marginBottom: "16px"
    },
    textFieldWrapper: {
        width: "100%",
        boxSizing: "border-box",
        margin: "8px 0px 16px 0px"
    },
    buttonGroup: {
        display: "flex",
        gap: "12px",
        justifyContent: "flex-end",
        marginBottom: "32px"
    },
    witnessTableWrapper: {
        overflowX: "auto",
        touchAction: "manipulation",
        contain: "style layout",
        "-webkit-overflow-scrolling": "touch"
    },
    witnessTable: {
        width: "100%",
        minWidth: "700px",
        borderCollapse: "collapse",
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(1),
        fontSize: "0.875rem",
        "& tr > th": {
            backgroundColor: "#191919",
            padding: theme.spacing(1.5),
            textAlign: "left",
            fontWeight: 600,
            borderBottom: `0px solid #ffffff12`,
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        },
        "& tr:hover > th": {
            backgroundColor: "#222",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "& tr > th:first-child": {
            borderRadius: "16px 0px 0px 0px"
        },
        "& tr > th:last-child": {
            borderRadius: "0px 16px 0px 0px",
        },
        "& tr > td": {
            backgroundColor: "transparent",
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        },
        "& tr:hover > td": {
            backgroundColor: "#171717",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        },
        "& tr:last-child > td:first-child": {
            borderRadius: "0px 0px 0px 16px"
        },
        "& tr:last-child > td:last-child": {
            borderRadius: "0px 0px 16px 0px",
        },
        "& td": {
            padding: "4px 12px",
            borderBottom: `1px solid #ffffff12`
        },
        "& tr:last-child td": {
            borderBottom: "0px"
        },
        "& tbody": {
            backgroundColor: "#101010"
        }
    },
    witnessCell: {
        display: "flex",
        gap: 8,
        alignItems: "center"
    },
    witnessAvatar: {
        margin: "8px 8px 8px 0px",
        borderRadius: "12px",
        backgroundSize: "cover",
        width: 42,
        height: 42
    },
    witnessInfo: {
        marginLeft: 8
    },
    witnessName: {
        display: "block",
        fontSize: "14px",
        fontFamily: "'Industry Book'"
    },
    witnessDescription: {
        marginTop: "4px",
        color: "#999",
        display: "block",
        fontSize: "11px",
        fontFamily: "'Normative Pro'"
    },
    versionBadge: {
        margin: "8px",
        padding: "4px 8px",
        borderRadius: "8px",
        backgroundColor: "#262626",
        color: "#fff",
        fontWeight: "bold",
        fontFamily: "'Geist Mono'",
        display: "inline"
    },
    monoText: {
        fontFamily: "'Geist Mono'"
    },
    blockInfo: {
        fontSize: "12px",
        fontFamily: "'Geist Mono'"
    },
    blockTime: {
        fontSize: "8px",
        color: "#666"
    },
    loadingWrap: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        color: "#666"
    },
    emptyRow: {
        padding: "24px !important",
        textAlign: "center",
        color: "#777",
        fontFamily: "'Normative Pro'"
    },
    witnessPanel: {
        marginTop: "32px",
        marginBottom: "16px",
        padding: "20px",
        borderRadius: "16px",
        backgroundColor: "#101010",
        border: "1px solid #ffffff12"
    },
    witnessPanelHeader: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px"
    },
    witnessBadge: {
        padding: "2px 8px",
        borderRadius: "8px",
        backgroundColor: "#262626",
        color: "#bbb",
        fontSize: "11px",
        fontFamily: "'Geist Mono'",
        fontWeight: "bold",
        letterSpacing: "0.5px"
    },
    broadcastError: {
        marginTop: "8px",
        padding: "8px 12px",
        borderRadius: "8px",
        backgroundColor: "#1a1a1a",
        color: "#bbb",
        border: "1px solid #ffffff1f",
        fontSize: "12px",
        fontFamily: "'Geist Mono'"
    },
    broadcastSuccess: {
        marginTop: "8px",
        padding: "8px 12px",
        borderRadius: "8px",
        backgroundColor: "#1a1a1a",
        color: "#bbb",
        border: "1px solid #ffffff1f",
        fontSize: "12px",
        fontFamily: "'Geist Mono'"
    }
});

// ──────────────────────────────────────────────────────────────
// Currency input (mirrors PixaWalletSendDialog's NumberFormatCustom):
// renders a numeric field with a chain-asset suffix, e.g. "1.000 PXS".
// ──────────────────────────────────────────────────────────────
function NumberFormatCustom(props) {
    const { inputRef, onChange, currency, ...other } = props;
    return (
        <NumericFormat
            {...other}
            ref={inputRef}
            onValueChange={(values) => {
                onChange({
                    target: {
                        name: props.name,
                        value: values.value,
                    },
                });
            }}
            thousandSeparator={" "}
            decimalSeparator={"."}
            allowedDecimalSeparators={[",", "."]}
            thousandsGroupStyle={'thousand'}
            decimalScale={3}
            fixedDecimalScale={false}
            allowNegative={false}
            allowLeadingZeros={true}
            suffix={" " + currency}
            prefix={""}
        />
    );
}

// ──────────────────────────────────────────────────────────────
// A witness is considered "active" when it has a real signing
// key. Disabled witnesses publish the null public key, which
// is a long run of 1s regardless of chain address prefix
// (STM / HIVE / PIX etc). Detecting a long 1-run is prefix-safe.
// ──────────────────────────────────────────────────────────────
const NULL_KEY_RUN_RE = /1{40,}/;
const isActiveWitness = (w) =>
    !!w && typeof w.signing_key === 'string' && !NULL_KEY_RUN_RE.test(w.signing_key);

// ──────────────────────────────────────────────────────────────
// Format helpers
// ──────────────────────────────────────────────────────────────
const formatVotes = (v) => {
    const n = typeof v === 'string' ? Number(v) : (v || 0);
    if (!isFinite(n) || n <= 0) return '0';
    // VESTS are huge — collapse into readable magnitudes.
    if (n >= 1e15) return `${(n / 1e15).toFixed(2)}P`;
    if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}G`;
    if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}k`;
    return String(Math.round(n));
};

const formatPriceFeed = (feed) => {
    // feed is witness.hbd_exchange_rate: { base: Asset, quote: Asset }
    // Returns PXS / PIXA. An untouched feed is 0/0 — render as em-dash.
    if (!feed) return '—';
    const parseAmount = (a) => {
        if (!a) return NaN;
        if (typeof a === 'string') {
            const m = a.match(/([\d.]+)/);
            return m ? Number(m[1]) : NaN;
        }
        if (typeof a === 'object' && 'amount' in a) {
            const p = Number(a.precision || 0);
            return Number(a.amount) / Math.pow(10, p);
        }
        return NaN;
    };
    const base = parseAmount(feed.base);
    const quote = parseAmount(feed.quote);
    if (!isFinite(base) || !isFinite(quote) || quote === 0) return '—';
    return `$${(base / quote).toFixed(3)}`;
};

// Was a hand-rolled English ladder ("3m ago", "2h ago"). utils/TimeAgo now
// speaks every locale the browser knows, so the only thing worth keeping here
// is the sentinel for a witness that has never produced a block.
const formatTimeAgo = (iso) => {
    if (!iso || String(iso).startsWith('1970')) return '—';
    return timeAgo.format(iso, { labels: 'short' }) || '—';
};

class GDVMWitnesses extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            customWitness: "",
            _loading: true,
            _witnesses: [],
            _avatars: {},          // { witnessName: imageUrl }
            _myVotes: new Set(),   // witness owner names the current user has voted for
            _currentAccount: null,
            // ── Witness self-administration ──
            _selfWitness: null,    // full witness record for the current account, or null
            _propsBaseFee: "0.000",         // account_creation_fee — locked to 0 PIXA for now
            _propsMaxBlockSize: 131072,     // maximum_block_size — locked
            _propsInterestRate: 0,          // pxs_interest_rate — uint16 basis points (locked to 0%)
            _propsUrl: "",                  // url — editable witness URL
            _propsBroadcasting: false,
            _propsError: "",
            _propsSuccess: false
        };
        this._mounted = false;
    }

    componentDidMount() {
        this._mounted = true;
        this._loadData();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.api !== this.props.api) this._loadData();
    }

    componentWillUnmount() {
        this._mounted = false;
    }

    _loadData = async () => {
        const { api } = this.props;
        if (!api?.witnesses) return;

        const currentAccount =
            api.sessionManager?.getCurrentAccountSync?.() ||
            api.sessionManager?.currentAccount ||
            null;

        try {
            // These three reads were previously awaited one after another, but
            // only Chain A is internally dependent. Branch B and Branch C need
            // nothing but `currentAccount` (resolved synchronously above), so we
            // start all three in the same tick and await them together. Latency
            // drops from (A + B + C) to max(A, B, C). Per-branch error handling
            // is unchanged: B and C resolve to safe defaults on failure; only
            // Chain A's root read can hard-fail the panel (outer catch below).

            // ── Chain A: top witnesses → their profile avatars ───────────────
            // getAccounts depends on the witness names, so this stays a 2-step
            // chain — but it now overlaps with B and C.
            const witnessesAndAvatars = (async () => {
                // Pull top witnesses by vote (descending). condenser_api's
                // get_witnesses_by_vote already returns the ordering we want.
                const raw = await api.witnesses.getWitnessesByVote('', 60);
                const list = Array.isArray(raw) ? raw : [];

                // "Listing only active witnesses" → drop disabled ones.
                // Cap at 30 since that's the max-votable set per the copy here.
                const active = list.filter(isActiveWitness).slice(0, 30);

                // Batch-fetch accounts to get profile images
                let avatars = {};
                if (active.length > 0 && api.accounts?.getAccounts) {
                    try {
                        const names = active.map(w => w.owner);
                        const accs = await api.accounts.getAccounts(names);
                        for (const acc of (accs || [])) {
                            if (acc?.name && acc?._profile?.profile_image) {
                                avatars[acc.name] = acc._profile.profile_image;
                            }
                        }
                    } catch (e) {
                        console.warn('[GDVMWitnesses] getAccounts for avatars failed:', e?.message);
                    }
                }
                return { active, avatars };
            })();

            // ── Branch B: current user's witness votes (independent) ─────────
            // Used to check/uncheck checkboxes.
            const myVotesPromise = (async () => {
                const myVotes = new Set();
                if (currentAccount && api.witnesses.listWitnessVotes) {
                    try {
                        const votes = await api.witnesses.listWitnessVotes({
                            start: [currentAccount, ''],
                            order: 'by_account_witness',
                            limit: 100
                        });
                        for (const v of (votes || [])) {
                            if (v?.account === currentAccount && v?.witness) {
                                myVotes.add(v.witness);
                            }
                        }
                    } catch (e) {
                        console.warn('[GDVMWitnesses] list_witness_votes failed:', e?.message);
                    }
                }
                return myVotes;
            })();

            // ── Branch C: is the current user themselves a witness? ──────────
            // Top-30 list might not include them (they could be ranked lower),
            // so query the chain directly. A witness with the disabled/null
            // signing key is treated as not-a-witness for this panel.
            const selfWitnessPromise = (async () => {
                let selfWitness = null;
                if (currentAccount && api.witnesses?.getWitnessByAccount) {
                    try {
                        const w = await api.witnesses.getWitnessByAccount(currentAccount);
                        if (w && isActiveWitness(w)) selfWitness = w;
                    } catch (e) {
                        console.warn('[GDVMWitnesses] getWitnessByAccount failed:', e?.message);
                    }
                }
                return selfWitness;
            })();

            // Run all three concurrently.
            const [{ active, avatars }, myVotes, selfWitness] = await Promise.all([
                witnessesAndAvatars,
                myVotesPromise,
                selfWitnessPromise,
            ]);

            // Seed the editable URL field from the witness's current
            // on-chain `url` so re-broadcasting "as is" doesn't accidentally
            // blank out a previously-set value.
            const seedUrl = (selfWitness && typeof selfWitness.url === 'string') ? selfWitness.url : "";

            if (!this._mounted) return;
            this.setState({
                _loading: false,
                _witnesses: active,
                _avatars: avatars,
                _myVotes: myVotes,
                _currentAccount: currentAccount,
                _selfWitness: selfWitness,
                _propsUrl: seedUrl
            }, () => this.forceUpdate());
        } catch (e) {
            console.warn('[GDVMWitnesses] failed to load witnesses:', e?.message);
            if (!this._mounted) return;
            this.setState({ _loading: false }, () => this.forceUpdate());
        }
    }

    _handleTableTouchStart = (e) => {
        e.stopPropagation();
    }

    _handleCustomWitnessChange = (e) => {
        this.setState({ customWitness: e.target.value });
    }

    _cleanAccountInput = (raw) =>
        String(raw || '').trim().replace(/^@/, '').toLowerCase();

    _handleToggleVote = async (witnessName, shouldApprove) => {
        const { api } = this.props;
        const { _currentAccount, _myVotes } = this.state;
        if (!api?.broadcast || !_currentAccount) return;

        // Optimistic flip
        const next = new Set(_myVotes);
        if (shouldApprove) next.add(witnessName); else next.delete(witnessName);
        this.setState({ _myVotes: next }, () => this.forceUpdate());

        try {
            await api.broadcast.accountWitnessVote(
                _currentAccount, witnessName, !!shouldApprove
            );
        } catch (e) {
            console.warn('[GDVMWitnesses] vote toggle failed:', e?.message);
            if (!this._mounted) return;
            this.setState({ _myVotes: _myVotes }, () => this.forceUpdate());
        }
    }

    _handleVoteForAccount = async () => {
        const { api } = this.props;
        const { _currentAccount } = this.state;
        const target = this._cleanAccountInput(this.state.customWitness);
        if (!target || !api?.broadcast || !_currentAccount) return;
        try {
            await api.broadcast.accountWitnessVote(_currentAccount, target, true);
            if (!this._mounted) return;
            this.setState({ customWitness: "" }, () => {
                this.forceUpdate();
                this._loadData();
            });
        } catch (e) {
            console.warn('[GDVMWitnesses] vote failed:', e?.message);
        }
    }

    _handleDelegateVote = async () => {
        const { api } = this.props;
        const { _currentAccount } = this.state;
        const target = this._cleanAccountInput(this.state.customWitness);
        if (!target || !api?.broadcast || !_currentAccount) return;
        try {
            await api.broadcast.accountWitnessProxy(_currentAccount, target);
            if (!this._mounted) return;
            this.setState({ customWitness: "" }, () => this.forceUpdate());
        } catch (e) {
            console.warn('[GDVMWitnesses] proxy failed:', e?.message);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Witness-properties helpers
    // ──────────────────────────────────────────────────────────────

    // Format a numeric string into the on-chain asset string with the
    // correct symbol and 3-decimal precision: "0.000 PIXA".
    _formatAsset = (amountStr, symbol) => {
        const n = Number(amountStr);
        const safe = isFinite(n) && n >= 0 ? n : 0;
        return `${safe.toFixed(3)} ${symbol}`;
    };

    _handlePropsUrlChange = (e) => {
        this.setState({
            _propsUrl: e.target.value,
            _propsError: "",
            _propsSuccess: false
        });
    };

    _handleBroadcastWitnessProps = async () => {
        const { api } = this.props;
        const {
            _currentAccount,
            _selfWitness,
            _propsBaseFee,
            _propsMaxBlockSize,
            _propsInterestRate,
            _propsUrl
        } = this.state;

        if (!_currentAccount || !_selfWitness || !api?.broadcast?.witnessSetProperties) {
            this.setState({ _propsError: "Missing account, witness record, or broadcast API." });
            return;
        }

        // Build the friendly WitnessProps object. The API layer
        // (BroadcastAPI.witnessSetProperties) calls dpixa's
        // utils.buildWitnessUpdateOp which serializes each value to its
        // on-chain hex form using the matching Types serializer.
        //
        // Type contract per dpixa's chain/serializer.ts:
        //   key                  → PublicKey (current block-signing key, REQUIRED)
        //   account_creation_fee → Asset (string "N.NNN PIXA")
        //   maximum_block_size   → uint32
        //   pxs_interest_rate    → uint16 (basis points; 100 = 1%)
        //   url                  → string (witness operator's URL)
        //
        // NOTE: account_creation_fee, maximum_block_size, and pxs_interest_rate
        // are intentionally locked for the first release. Only `url` is
        // operator-editable here.
        //
        // `key` is sourced from the witness's current on-chain signing_key.
        // It's required by the chain even when we aren't rotating it; we
        // pass through the existing value unchanged.
        const signingKey = _selfWitness.signing_key;
        if (!signingKey) {
            this.setState({
                _propsError: "No signing key on the witness record — cannot broadcast."
            });
            return;
        }

        const props = {
            key: signingKey,
            account_creation_fee: this._formatAsset(_propsBaseFee, 'PIXA'),
            maximum_block_size: Number(_propsMaxBlockSize) >>> 0,
            pxs_interest_rate: Number(_propsInterestRate) & 0xffff,
            url: String(_propsUrl || "").trim()
        };

        this.setState({
            _propsBroadcasting: true,
            _propsError: "",
            _propsSuccess: false
        });

        try {
            await api.broadcast.witnessSetProperties(_currentAccount, props);
            if (!this._mounted) return;
            this.setState({
                _propsBroadcasting: false,
                _propsSuccess: true
            }, () => this.forceUpdate());
        } catch (e) {
            console.warn('[GDVMWitnesses] witnessSetProperties failed:', e?.message);
            if (!this._mounted) return;
            this.setState({
                _propsBroadcasting: false,
                _propsError: e?.message || "Broadcast failed."
            }, () => this.forceUpdate());
        }
    };

    // Placeholder rows matching the 8-column witness table (rank, avatar+name,
    // version, votes, block info, two mono columns, vote checkbox) so the table
    // doesn't resize or jump when real rows arrive. Skeleton provides its own
    // theme-aware shimmer.
    _renderLoadingSkeleton = () => {
        const { classes } = this.props;
        return [0, 1, 2, 3, 4, 5].map((i) => (
            <tr key={`sk-${i}`} aria-busy="true">
                <td className={classes.monoText}><Skeleton variant="text" width={20} /></td>
                <td>
                    <div className={classes.witnessCell}>
                        <Skeleton variant="circle" width={32} height={32} style={{ marginRight: 8 }} />
                        <div className={classes.witnessInfo}>
                            <Skeleton variant="text" width={90} height={14} />
                            <Skeleton variant="text" width={140} height={11} />
                        </div>
                    </div>
                </td>
                <td><Skeleton variant="rect" width={44} height={16} style={{ borderRadius: 4 }} /></td>
                <td className={classes.monoText}><Skeleton variant="text" width={70} /></td>
                <td>
                    <Skeleton variant="text" width={60} height={12} />
                    <Skeleton variant="text" width={40} height={10} />
                </td>
                <td className={classes.monoText}><Skeleton variant="text" width={48} /></td>
                <td className={classes.monoText}><Skeleton variant="text" width={48} /></td>
                <td><Skeleton variant="rect" width={18} height={18} style={{ borderRadius: 3 }} /></td>
            </tr>
        ));
    };

    _renderWitnessRow = (witness, index) => {
        const { classes } = this.props;
        const { _myVotes, _currentAccount, _avatars } = this.state;
        const name = witness.owner;
        const voted = _myVotes.has(name);
        const labelId = `witness-vote-${name}`;
        const avatarUrl = _avatars[name] || '';

        return (
            <tr key={name}>
                <td className={classes.monoText} style={{ fontWeight: "bold" }}>
                    #{index + 1}
                </td>
                <td>
                    <div className={classes.witnessCell}>
                        <ButtonBase style={{ borderRadius: "12px" }}>
                            <div
                                className={`pixelated ${classes.witnessAvatar}`}
                                style={{ backgroundImage: cssBackgroundImage(avatarUrl) }}
                            />
                        </ButtonBase>
                        <div className={classes.witnessInfo}>
                            <strong className={classes.witnessName}>
                                @{name}
                            </strong>
                            <span className={classes.witnessDescription}>
                                {witness.url || ''}
                            </span>
                        </div>
                    </div>
                </td>
                <td>
                    <div className={classes.versionBadge}>
                        {witness.running_version || '—'}
                    </div>
                </td>
                <td className={classes.monoText}>{formatVotes(witness.votes)}</td>
                <td>
                    <div className={classes.blockInfo}>
                        #{witness.last_confirmed_block_num || '—'}
                    </div>
                    <div className={classes.blockTime}>
                        ({formatTimeAgo(witness.last_aslot_time || witness.created)})
                    </div>
                </td>
                <td className={classes.monoText}>
                    {witness.total_missed != null ? witness.total_missed : '—'}
                </td>
                <td className={classes.monoText}>
                    {formatPriceFeed(witness.hbd_exchange_rate)}
                </td>
                <td>
                    <Checkbox
                        edge="end"
                        checked={voted}
                        disabled={!_currentAccount}
                        onChange={(_e, checked) => this._handleToggleVote(name, checked)}
                        inputProps={{ 'aria-labelledby': labelId }}
                    />
                </td>
            </tr>
        );
    }

    // ──────────────────────────────────────────────────────────────
    // Witness self-administration panel
    // Rendered only when the logged-in account is itself an active witness.
    // The first three properties are locked for the initial release; only
    // the witness `url` is operator-editable.
    // ──────────────────────────────────────────────────────────────
    _renderWitnessAdminPanel = () => {
        const { classes } = this.props;
        const {
            _selfWitness,
            _currentAccount,
            _propsBaseFee,
            _propsMaxBlockSize,
            _propsInterestRate,
            _propsUrl,
            _propsBroadcasting,
            _propsError,
            _propsSuccess
        } = this.state;

        if (!_currentAccount || !_selfWitness) return null;

        // The url is optional on-chain (empty string is valid), so the
        // broadcast button only blocks while a broadcast is in flight.
        const canBroadcast = !_propsBroadcasting;

        return (
            <div className={classes.witnessPanel}>
                <div className={classes.witnessPanelHeader}>
                    <Typography className={classes.sectionTitle} style={{ marginBottom: 0 }}>
                        {t("components.gdvmwitnesses.witness_properties")}
                    </Typography>
                    <span className={classes.witnessBadge}>{t("components.gdvmwitnesses.you_are_a_witness")}</span>
                </div>
                <Typography className={classes.sectionDescription}><T
                        k="components.gdvmwitnesses.broadcast_a_new_set_of_chain_parameters"
                        vars={{
                            currentAccount: _currentAccount
                        }} /></Typography>
                <TextField
                    className={classes.textFieldWrapper}
                    label={t("components.gdvmwitnesses.account_creation_fee")}
                    variant="outlined"
                    fullWidth
                    disabled
                    value={_propsBaseFee}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                        inputComponent: NumberFormatCustom,
                        inputProps: { currency: "PIXA" }
                    }}
                />
                <TextField
                    className={classes.textFieldWrapper}
                    label={t("components.gdvmwitnesses.maximum_block_size_bytes")}
                    variant="outlined"
                    fullWidth
                    disabled
                    value={String(_propsMaxBlockSize)}
                    InputLabelProps={{ shrink: true }}
                />
                <TextField
                    className={classes.textFieldWrapper}
                    label={t("components.gdvmwitnesses.pxs_interest_rate_basis_points_100_1")}
                    variant="outlined"
                    fullWidth
                    disabled
                    value={String(_propsInterestRate)}
                    InputLabelProps={{ shrink: true }}
                />
                <TextField
                    className={classes.textFieldWrapper}
                    label={t("components.gdvmwitnesses.witness_url")}
                    placeholder="https://your-witness.example"
                    variant="outlined"
                    fullWidth
                    value={_propsUrl}
                    onChange={this._handlePropsUrlChange}
                    disabled={_propsBroadcasting}
                    InputLabelProps={{ shrink: true }}
                />
                {_propsError ? (
                    <div className={classes.broadcastError}>{_propsError}</div>
                ) : null}
                {_propsSuccess ? (
                    <div className={classes.broadcastSuccess}>
                        {t("components.gdvmwitnesses.properties_broadcast_successfully")}
                    </div>
                ) : null}
                <div className={classes.buttonGroup} style={{ marginTop: "16px", marginBottom: 0 }}>
                    <Button
                        variant="contained"
                        onClick={this._handleBroadcastWitnessProps}
                        disabled={!canBroadcast}
                    >
                        {_propsBroadcasting ? (
                            <>
                                <CircularProgress size={16} style={{ marginRight: 8, color: "inherit" }} />
                                {t("words.broadcasting")}
                            </>
                        ) : "Broadcast Properties"}
                    </Button>
                </div>
            </div>
        );
    };

    render() {
        const { classes } = this.props;
        const { _loading, _witnesses, _currentAccount } = this.state;
        const canAct = !!_currentAccount;

        return (
            <DialogContent className={classes.dialogContent}>
                <Typography className={classes.sectionTitle}>
                    {t("components.gdvmwitnesses.vote_for_witnesses")}
                </Typography>
                <Typography className={classes.sectionDescription}>
                    {t("words.you_can_delegate_your_vote_if_you")}
                </Typography>
                <div className={classes.textFieldWrapper}>
                    <TextField
                        id="custom-witness"
                        label={t("words.username_2")}
                        variant="outlined"
                        fullWidth
                        value={this.state.customWitness}
                        onChange={this._handleCustomWitnessChange}
                    />
                </div>
                <div className={classes.buttonGroup}>
                    <Button
                        variant="outlined"
                        onClick={this._handleVoteForAccount}
                        disabled={!canAct || !this.state.customWitness.trim()}
                    >
                        {t("words.vote_for_account")}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={this._handleDelegateVote}
                        disabled={!canAct || !this.state.customWitness.trim()}
                    >
                        {t("words.delegate_my_vote")}
                    </Button>
                </div>
                {this._renderWitnessAdminPanel()}
                <Typography className={classes.sectionTitle}>
                    {t("words.top_witnesses")}
                </Typography>
                <Typography className={classes.sectionDescription}>
                    {t("components.gdvmwitnesses.you_can_vote_for_up_to_30")}
                </Typography>
                <div
                    className={classes.witnessTableWrapper}
                    onTouchStart={this._handleTableTouchStart}
                    onTouchMove={this._handleTableTouchStart}
                >
                    <table className={classes.witnessTable}>
                        <thead>
                        <tr>
                            <th>{t("words.rank")}</th>
                            <th>{t("words.witness")}</th>
                            <th>{t("words.version")}</th>
                            <th>{t("words.votes")}</th>
                            <th>{t("words.last_block")}</th>
                            <th>{t("words.miss")}</th>
                            <th>{t("words.price_feed")}</th>
                            <th>{t("words.voted")}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {_loading ? (
                            this._renderLoadingSkeleton()
                        ) : _witnesses.length === 0 ? (
                            <tr>
                                <td colSpan={8} className={classes.emptyRow}>
                                    {t("components.gdvmwitnesses.no_active_witnesses_found")}
                                </td>
                            </tr>
                        ) : (
                            _witnesses.map((w, i) => this._renderWitnessRow(w, i))
                        )}
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDVMWitnesses));