import * as React from "preact/compat";
import { useState, useEffect, useRef, useCallback } from "preact/hooks";

import withStyles from "@material-ui/core/styles/withStyles";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Tooltip from "@material-ui/core/Tooltip";
import ButtonBase from "@material-ui/core/ButtonBase";
import Card from "@material-ui/core/Card";
import Collapse from "@material-ui/core/Collapse";
import Skeleton from "@material-ui/lab/Skeleton";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import InfoIcon from "@material-ui/icons/Info";
import AddIcon from "@material-ui/icons/Add";
import InboxIcon from "@material-ui/icons/InboxOutlined";
import { Pageview } from "@material-ui/icons";
import { HISTORY } from "../utils/constants";
// usePrices is a Preact hook; it lives one level under src in hooks/.
// Adjust this path if your layout differs (it imports ../utils/settings).
import { usePrices } from "../hooks/usePrices";
import { safeHTML } from "../utils/api/sanitizer";
import { cssBackgroundImage } from "../utils/safeUrl";

import { t } from "../utils/text";

import { withLanguage } from "../utils/withLanguage";
/**
 * Render user-supplied markdown at the correct trust tier.
 *
 * pixaproxyapi documents four WASM-backed tiers and states that every string
 * reaching dangerouslySetInnerHTML must pass through one of them. Until now
 * none of them had a single caller: every site used safeHTML(), which applies
 * the POST allowlist — headings, tables, images — to comment bodies, and does
 * no markdown rendering at all.
 *
 * sanitizeCommentHTML() renders AND sanitises at the comment tier in one
 * synchronous call. safeHTML stays as the fallback for the case where `api`
 * has not been threaded in yet, so this can never render less safely than it
 * did before.
 */
function renderCommentBody(api, body) {
    if (!body) return "";
    if (api && typeof api.sanitizeCommentHTML === "function") return api.sanitizeCommentHTML(body);
    return safeHTML(body);
}

function renderPostBody(api, body) {
    if (!body) return "";
    if (api && typeof api.sanitizePostHTML === "function") return api.sanitizePostHTML(body);
    return safeHTML(body);
}


// ──────────────────────────────────────────────────────────────
// Community routing — the official Pixagram community in which
// proposal posts live. Update the slug here if the on-chain
// community id changes; both the "View Proposal" link and the
// "Create Proposal" button read from these constants.
// ──────────────────────────────────────────────────────────────
const PROPOSALS_COMMUNITY_URL = `portal-183616`;
const PROPOSAL_CREATE_URL = `/${PROPOSALS_COMMUNITY_URL}/created/editor`;

const styles = theme => ({
    dialogContent: {
        padding: "24px"
    },
    tooltip: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        fontFamily: "'Normative Pro'",
        lineHeight: "22px"
    },
    // ── DPF Stats Box ────────────────────────────────────────
    dpfStatsBox: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "24px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "16px",
        margin: "0px 0px 24px 0px",
        transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 75ms",
        "&:hover": {
            backgroundColor: "#171717",
            transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    dpfStatsHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "'Industry Book'",
    },
    dpfStatsTitle: {
        fontSize: "32px",
        fontWeight: 600,
        color: "#e0e0e0",
        display: "flex",
        alignItems: "center",
        gap: "8px"
    },
    dpfInfoIcon: {
        fontSize: "18px",
        color: "#888",
        cursor: "pointer",
        transition: "color 150ms ease",
        "&:hover": {
            color: "#aaa"
        }
    },
    dpfStatsGrid: {
        display: "flex",
        flex: "1 1 auto",
        flexWrap: "wrap",
        gap: "24px",
        [theme.breakpoints.down("sm")]: {
            gap: "16px"
        }
    },
    dpfStatItem: {
        flex: "1 1 auto",
        minWidth: "120px",
        textAlign: "center",
        [theme.breakpoints.down("sm")]: {
            minWidth: "calc(50% - 16px)"
        }
    },
    dpfStatLabel: {
        fontSize: "14px",
        fontWeight: 500,
        color: "#888",
        textTransform: "uppercase",
        fontFamily: "'Industry Book'",
        letterSpacing: "0.5px",
        marginBottom: "4px"
    },
    dpfStatValue: {
        fontSize: "21px",
        fontWeight: 500,
        color: "#ffffff",
        fontFamily: "'Geist Mono', monospace"
    },
    dpfStatFiat: {
        fontSize: "12px",
        color: "#6e6e6e",
        fontFamily: "'Geist Mono', monospace",
        marginTop: "2px"
    },
    // "Create Proposal" CTA — white, lives in the stats header.
    createProposalButton: {
        backgroundColor: "#ffffff",
        color: "#000000 !important",
        fontFamily: "'Industry Book'",
        fontWeight: 600,
        textTransform: "none",
        borderRadius: "14px",
        padding: "10px 18px",
        whiteSpace: "nowrap",
        alignSelf: "center",
        marginLeft: "auto",
        "&:hover": {
            backgroundColor: "#e6e6e6",
            color: "#000"
        },
        [theme.breakpoints.down("sm")]: {
            width: "100%",
            marginLeft: 0
        }
    },
    // ── Proposal Card ────────────────────────
    proposalCard: {
        "&.MuiCard-root": {
            position: "relative",
            width: "100%",
            backgroundColor: "#101010",
            border: "none",
            boxShadow: "none",
            borderRadius: "21px",
            marginBottom: "12px",
            overflow: "hidden",
            transition: "background-color 225ms cubic-bezier(0.4, 0, 0.2, 1) 25ms"
        },
        "&.MuiCard-root:hover": {
            backgroundColor: "#181818"
        }
    },
    proposalCardExpanded: {
        "&.MuiCard-root": {
            backgroundColor: "#1c1c1c"
        },
        "&.MuiCard-root:hover": {
            backgroundColor: "#1c1c1c"
        }
    },
    proposalHeader: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "16px 20px",
        cursor: "pointer",
        userSelect: "none",
        outline: "none",
        "&:focus-visible": {
            boxShadow: "inset 0 0 0 2px #333"
        },
        [theme.breakpoints.down("sm")]: {
            flexWrap: "wrap",
            gap: "12px",
            padding: "14px 16px"
        }
    },
    proposalChevron: {
        color: "#888",
        flexShrink: 0,
        transition: "transform 320ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms ease"
    },
    proposalChevronExpanded: {
        transform: "rotate(180deg)",
        color: "#dddddd"
    },
    proposalBodyWrap: {
        padding: "4px 20px 16px 20px",
        [theme.breakpoints.down("sm")]: {
            padding: "4px 16px 14px 16px"
        }
    },
    proposalMainInfo: {
        flex: "1 1 auto",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
    },
    proposalTitleRow: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
        fontSize: "14px",
        marginBottom: "2px"
    },
    proposalId: {
        fontSize: "13px",
        fontWeight: 500,
        color: "#666",
        fontFamily: "'Geist Mono', monospace"
    },
    proposalMeta: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap"
    },
    proposalDate: {
        fontSize: "12px",
        color: "#777",
        fontFamily: "'Geist Mono', monospace"
    },
    proposalFunding: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#ffffff",
        fontFamily: "'Geist Mono', monospace"
    },
    proposalDaily: {
        fontSize: "11px",
        color: "#888",
        fontFamily: "'Geist Mono', monospace"
    },
    proposalFundingFiat: {
        fontSize: "11px",
        color: "#777",
        fontFamily: "'Geist Mono', monospace"
    },
    proposalStatusChip: {
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        padding: "2px 8px",
        borderRadius: "12px",
        backgroundColor: "#ffffff",
        color: "#000000"
    },
    proposalTitle: {
        color: "#fff",
    },
    proposalTitleExpired: {
        color: "#333",
    },
    proposalTitlePending: {
        color: "#999",
    },
    proposalStatusChipPending: {
        backgroundColor: "#999",
        color: "#111"
    },
    proposalStatusChipExpired: {
        backgroundColor: "#444",
        color: "#9e9e9e"
    },
    proposalVoteInfo: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "4px",
        minWidth: "100px",
        [theme.breakpoints.down("sm")]: {
            alignItems: "flex-start",
            marginTop: "8px"
        }
    },
    proposalVoteCount: {
        fontSize: "18px",
        fontWeight: 700,
        color: "#e0e0e0",
        fontFamily: "'Geist Mono', monospace",
        display: "flex",
        alignItems: "center",
        gap: "6px"
    },
    proposalVoteLabel: {
        fontSize: "10px",
        color: "#777",
        textTransform: "uppercase",
        letterSpacing: "0.5px"
    },
    proposalContent: {
        fontSize: "0.95rem",
        lineHeight: 1.55,
        color: "#aaa",
        fontFamily: "'Normative Pro'",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        margin: "4px 0px 16px 0px",
        "& > *:first-child": { marginTop: 0 },
        "& > *:last-child": { marginBottom: 0 },
        "& h1, & h2, & h3, & h4, & h5, & h6": {
            fontFamily: "'Industry Book'",
            fontWeight: "normal",
            color: "#eeeeee",
            lineHeight: 1.25
        },
        "& h1": { fontSize: "1.5rem", margin: "1.5rem 0 0.75rem" },
        "& h2": { fontSize: "1.3rem", margin: "1.4rem 0 0.6rem", color: "#ffffff" },
        "& h3": { fontSize: "1.12rem", margin: "1.2rem 0 0.5rem" },
        "& p": { margin: "0 0 0.9rem" },
        "& ul, & ol": { margin: "0 0 0.9rem", paddingLeft: "1.4rem" },
        "& li": { marginBottom: "0.3rem" },
        "& img": {
            maxWidth: "100%",
            height: "auto",
            borderRadius: "12px",
            display: "block",
            margin: "0.75rem 0"
        },
        "& a": { color: "#ffffff", textDecoration: "underline" },
        "& blockquote": {
            borderLeft: "3px solid #333333",
            paddingLeft: "1rem",
            margin: "0 0 0.9rem",
            fontStyle: "italic",
            color: "#888888"
        },
        "& code": {
            backgroundColor: "#1a1a1a",
            padding: "2px 6px",
            borderRadius: "5px",
            fontFamily: "'Geist Mono', monospace",
            fontSize: "0.85em",
            color: "#cccccc"
        },
        "& pre": {
            backgroundColor: "#0a0a0a",
            border: "1px solid #1c1c1c",
            padding: "0.9rem",
            borderRadius: "12px",
            overflow: "auto"
        },
        "& pre code": { backgroundColor: "transparent", padding: 0 },
        "& hr": { border: "none", borderTop: "1px solid #222222", margin: "1.2rem 0" },
        "& table": {
            width: "100%",
            borderCollapse: "collapse",
            margin: "0 0 0.9rem",
            fontSize: "0.85rem"
        },
        "& th, & td": { border: "1px solid #222222", padding: "6px 10px", textAlign: "left" }
    },
    proposalContentEmpty: {
        fontSize: "0.9rem",
        color: "#666666",
        fontStyle: "italic",
        fontFamily: "'Normative Pro'",
        margin: "4px 0 16px"
    },
    proposalContentSkeleton: {
        margin: "8px 0 16px"
    },
    proposalAuthorRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "16px"
    },
    proposalAuthorAvatar: {
        width: 36,
        height: 36,
        borderRadius: "10px",
        backgroundSize: "cover",
        backgroundPosition: "center"
    },
    proposalAuthorInfo: {
        display: "flex",
        flexDirection: "column"
    },
    proposalAuthorName: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#ffffff",
        fontFamily: "'Industry Book'",
    },
    proposalReceiverName: {
        fontSize: "14px",
        color: "#888",
        fontFamily: "'Industry Book'",
    },
    proposalDescription: {
        fontSize: "14px",
        lineHeight: 1.6,
        color: "#aaa",
        fontFamily: "'Normative Pro'",
        marginBottom: "16px"
    },
    proposalStatsRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: "24px",
        marginTop: "12px",
        padding: "16px",
        backgroundColor: "#101010",
        borderRadius: "16px"
    },
    proposalStatBlock: {
        flex: "1 1 auto",
        minWidth: "90px",
        textAlign: "center"
    },
    proposalStatBlockLabel: {
        fontSize: "12px",
        color: "#666",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginBottom: "4px",
        fontFamily: "'Industry Book'",
        fontWeight: "bold"
    },
    proposalStatBlockValue: {
        fontSize: "16px",
        fontWeight: 400,
        color: "#e0e0e0",
        fontFamily: "'Geist Mono', monospace"
    },
    proposalStatBlockFiat: {
        fontSize: "11px",
        color: "#6e6e6e",
        fontFamily: "'Geist Mono', monospace",
        marginTop: "2px"
    },
    // ── Actions row: checkbox + View Proposal, both on the right
    proposalActions: {
        padding: "12px 16px",
        justifyContent: "flex-end",
        gap: "8px",
        borderRadius: "0px 0px 16px 16px"
    },
    voteCheckboxLabel: {
        color: "#ddd",
        fontFamily: "'Industry Book'",
        fontSize: "14px",
        marginRight: "4px",
        "& .MuiFormControlLabel-label": {
            fontFamily: "'Industry Book'",
            fontSize: "14px"
        }
    },
    viewProposalButton: {
        color: "#888",
        fontSize: "12px",
        textTransform: "none",
        "&:hover": {
            color: "#fbfbfb",
            backgroundColor: "transparent"
        }
    },
    sectionDivider: {
        margin: "32px 0px 16px 0px",
        fontSize: "14px",
        fontWeight: 600,
        color: "#666",
        textTransform: "uppercase",
        letterSpacing: "1px"
    },
    // ── Return Proposal (threshold) card ─────────────────────
    returnProposalCard: {
        backgroundColor: "#101010",
        borderRadius: "16px",
        padding: "20px 24px",
        margin: "24px 0px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
        transition: "background-color 200ms ease",
        "&:hover": {
            backgroundColor: "#171717"
        }
    },
    returnProposalLeft: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flex: "1 1 auto",
        minWidth: 0,
    },
    returnProposalTitle: {
        fontSize: "15px",
        fontWeight: 600,
        color: "#e0e0e0",
        fontFamily: "'Industry Book'",
        whiteSpace: "nowrap",
    },
    returnProposalInfoIcon: {
        fontSize: "16px",
        color: "#666",
        cursor: "pointer",
        flexShrink: 0,
        transition: "color 150ms ease",
        "&:hover": {
            color: "#aaa"
        }
    },
    returnProposalVotes: {
        fontSize: "15px",
        fontWeight: 700,
        color: "#e0e0e0",
        fontFamily: "'Geist Mono', monospace",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        whiteSpace: "nowrap",
    },
    returnProposalVoteLabel: {
        fontSize: "10px",
        color: "#777",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginRight: "12px",
    },
    // ── Loading & empty states ───────────────────────────────
    loadingWrap: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 16px",
        color: "#666"
    },
    emptyWrap: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "48px 24px",
        backgroundColor: "#101010",
        borderRadius: "16px",
        gap: "12px"
    },
    emptyIcon: {
        fontSize: "48px",
        color: "#444"
    },
    emptyTitle: {
        fontSize: "18px",
        fontWeight: 600,
        color: "#ccc",
        fontFamily: "'Industry Book'"
    },
    emptyText: {
        fontSize: "14px",
        color: "#777",
        fontFamily: "'Normative Pro'",
        maxWidth: "420px",
        lineHeight: 1.5
    },
    emptyCta: {
        marginTop: "8px",
        backgroundColor: "#ffffff",
        color: "#000",
        fontFamily: "'Industry Book'",
        fontWeight: 600,
        textTransform: "none",
        borderRadius: "14px",
        padding: "10px 18px",
        "&:hover": { backgroundColor: "#e6e6e6" }
    }
});

// ──────────────────────────────────────────────────────────────
// Map a chain-side proposal (list_proposals result) to the
// UI-friendly shape the component renders. Dates come back as
// naive UTC strings (no trailing Z), so we suffix Z to parse.
// ──────────────────────────────────────────────────────────────
const _fmtDate = (d) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const mapProposal = (p) => {
    const start = new Date(String(p.start_date || '').replace(/Z?$/, 'Z'));
    const end = new Date(String(p.end_date || '').replace(/Z?$/, 'Z'));
    const now = new Date();

    const msPerDay = 86400000;
    const durationDays = Math.max(0, Math.round((end - start) / msPerDay));
    const daysRemaining = Math.max(0, Math.round((end - now) / msPerDay));
    const daysElapsed = Math.max(0, durationDays - daysRemaining);

    // daily_pay is NAI-form: { amount: "4800", precision: 3, nai: "@@..." }
    const dp = parseFloat(String(p.daily_pay || "0.000 PXS").split(" ")[0]);
    const precision = 3;
    const dailyPay = dp.toFixed(precision);

    const totalFunding = dailyPay * durationDays;
    const paidOut = dailyPay * daysElapsed;
    const remaining = Math.max(0, totalFunding - paidOut);

    // Raw total_votes is VESTS-scale; keep as number for the card,
    // formatVotes() below collapses it into k/m.
    const votes = Number(p.total_votes || 0);

    // Map chain status onto the three UI buckets the styles know.
    // If the chain provides a status field, use it; otherwise infer
    // from dates so proposals display correctly even when the fork
    // omits the status property.
    let uiStatus;
    if (p.status) {
        uiStatus =
            p.status === 'active' ? 'active' :
                p.status === 'votable' ? 'pending' :
                    p.status === 'inactive' ? 'expired' :
                        p.status === 'expired' ? 'expired' : 'pending';
    } else {
        // Infer from dates
        if (now >= start && now <= end) uiStatus = 'active';
        else if (now < start) uiStatus = 'pending';
        else uiStatus = 'expired';
    }

    return {
        id: p.proposal_id != null ? p.proposal_id : p.id,
        rawStatus: p.status,
        status: uiStatus,
        title: p.subject || '(untitled proposal)',
        startDate: _fmtDate(start),
        endDate: _fmtDate(end),
        duration: `${durationDays} days`,
        totalFunding,
        dailyPay,
        votes,
        author: p.creator,
        receiver: p.receiver,
        description: "",
        paidOut,
        remaining,
        daysRemaining,
        permlink: p.permlink,
        link: `/${PROPOSALS_COMMUNITY_URL}/@${p.creator}/${p.permlink}`
    };
};

// ──────────────────────────────────────────────────────────────
// ReturnProposalCard — the "return proposal" (id 0) acts as the
// dynamic funding threshold.  Proposals with more votes than this
// threshold get funded from the DAO treasury; those below it do
// not.  This card cannot be collapsed; it shows only a title, an
// info tooltip, the current vote weight, and a vote button.
// ──────────────────────────────────────────────────────────────
const ReturnProposalCard = ({ classes, proposal, voted, canVote, onToggleVote }) => {
    const formatVotes = (votes) => {
        if (votes >= 1e9) return `${(votes / 1e9).toFixed(2)}b`;
        if (votes >= 1e6) return `${(votes / 1e6).toFixed(2)}m`;
        if (votes >= 1e3) return `${(votes / 1e3).toFixed(1)}k`;
        return String(Math.round(votes));
    };

    return (
        <div className={classes.returnProposalCard}>
            <div className={classes.returnProposalLeft}>
                <span className={classes.returnProposalTitle}>
                    {t("components.gdvmproposals.active_proposals_dynamic_threshold")}
                </span>
                <Tooltip
                    arrow
                    interactive
                    title={
                        <div className={classes.tooltip}>
                            {t("components.gdvmproposals.the_return_proposal_sets_the_funding_threshold")}
                        </div>
                    }
                >
                    <InfoIcon className={classes.returnProposalInfoIcon} />
                </Tooltip>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <span className={classes.returnProposalVotes}>
                    {formatVotes(proposal.votes)}
                </span>
                <span className={classes.returnProposalVoteLabel}>{t("words.pixa_power")}</span>
                <FormControlLabel
                    className={classes.voteCheckboxLabel}
                    control={
                        <Checkbox
                            checked={!!voted}
                            disabled={!canVote}
                            onChange={(_e, checked) => onToggleVote(proposal.id, checked)}
                            color="default"
                        />
                    }
                    label={t("components.gdvmproposals.vote")}
                />
            </div>
        </div>
    );
};

// shared formatters (module-level so every card + the treasury share them)
const fmtVotes = (votes) => {
    const v = Number(votes) || 0;
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}b`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)}m`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
    return String(Math.round(v));
};
const fmtPXS = (amount) => {
    const a = Number(amount) || 0;
    if (a >= 1000) return `${(a / 1000).toFixed(2)}k PXS`;
    return `${Math.round(a)} PXS`;
};

// ──────────────────────────────────────────────────────────────
// ProposalCard — the proposal rendered as a real, self-contained card.
// Collapsed it shows the avatar, title/meta and live vote weight with a
// chevron; expanded (MUI Collapse) it reveals the author/receiver, the
// proposal's on-chain post body — lazily fetched via api.content.getContent
// and run through safeHTML, exactly like BlogPostDialog — a stats grid in
// which every PXS figure carries its FIAT equivalent, and the vote / view
// actions. Vote state and the single-open-at-a-time expansion are lifted to
// the parent. Greyscale only: no hues anywhere.
// ──────────────────────────────────────────────────────────────
const ProposalCard = ({
                          classes, api, proposal, expanded, onExpandChange,
                          voted, canVote, onToggleVote, avatarUrl, fiatFor
                      }) => {
    const [body, setBody] = useState('');
    const [bodyLoading, setBodyLoading] = useState(false);
    const [bodyError, setBodyError] = useState(false);
    const fetchedRef = useRef(false);

    // Pull the proposal's post body the first time the card is opened.
    // fetchedRef caches the result so re-opening never refetches; on failure
    // we clear the flag so a later open can retry.
    useEffect(() => {
        if (!expanded || fetchedRef.current) return undefined;
        if (!api || !api.content || typeof api.content.getContent !== 'function') return undefined;
        if (!proposal.author || !proposal.permlink) return undefined;

        let cancelled = false;
        fetchedRef.current = true;
        setBodyLoading(true);
        setBodyError(false);

        api.content.getContent(proposal.author, proposal.permlink)
            .then((res) => {
                if (cancelled) return;
                const raw = (res && (res.body || res.content)) || '';
                setBody(raw);
                setBodyLoading(false);
            })
            .catch((e) => {
                if (cancelled) return;
                console.warn('[GDVMProposals] getContent failed:', e && e.message);
                setBodyError(true);
                setBodyLoading(false);
                fetchedRef.current = false;
            });

        return () => { cancelled = true; };
    }, [expanded, api, proposal.author, proposal.permlink]);

    const stop = (e) => { if (e && e.stopPropagation) e.stopPropagation(); };
    const goAuthor = (e, who) => { stop(e); HISTORY.push(`/@${who}`); };
    const toggle = () => onExpandChange(proposal.id, !expanded);
    const onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    };

    const titleClass =
        proposal.status === 'pending' ? classes.proposalTitlePending :
            proposal.status === 'expired' ? classes.proposalTitleExpired :
                classes.proposalTitle;
    const chipClass =
        proposal.status === 'pending'
            ? `${classes.proposalStatusChip} ${classes.proposalStatusChipPending}`
            : proposal.status === 'expired'
                ? `${classes.proposalStatusChip} ${classes.proposalStatusChipExpired}`
                : classes.proposalStatusChip;

    const headerFiat = fiatFor ? fiatFor(proposal.totalFunding) : null;

    const StatBlock = (label, pxsText, amount) => {
        const fiat = (fiatFor && amount != null) ? fiatFor(amount) : null;
        return (
            <div className={classes.proposalStatBlock}>
                <div className={classes.proposalStatBlockLabel}>{label}</div>
                <div className={classes.proposalStatBlockValue}>{pxsText}</div>
                {fiat ? <div className={classes.proposalStatBlockFiat}>≈ {fiat}</div> : null}
            </div>
        );
    };

    return (
        <Card className={`${classes.proposalCard}${expanded ? ` ${classes.proposalCardExpanded}` : ''}`}>
            {/* Header — the whole row toggles; avatar/author links stopPropagation */}
            <div
                className={classes.proposalHeader}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={toggle}
                onKeyDown={onKey}
            >
                <div className={classes.proposalMainInfo}>
                    <div className={classes.proposalTitleRow}>
                        <span className={titleClass}>{proposal.title}</span>
                        <span className={classes.proposalId}>#{proposal.id}</span>
                        <span className={chipClass}>{proposal.status}</span>
                    </div>
                    <div className={classes.proposalMeta}>
                        <span className={classes.proposalDate}>
                            {proposal.startDate} - {proposal.endDate} ({proposal.duration})
                        </span>
                        <span className={classes.proposalFunding}>{fmtPXS(proposal.totalFunding)}</span>
                        {headerFiat ? (
                            <span className={classes.proposalFundingFiat}>≈ {headerFiat}</span>
                        ) : null}
                        <span className={classes.proposalDaily}>{t("components.gdvmproposals.daily_pxs", {
                                round: Math.round(proposal.dailyPay)
                            })}</span>
                    </div>
                </div>
                <div className={classes.proposalVoteInfo}>
                    <span className={classes.proposalVoteCount}>{fmtVotes(proposal.votes)}</span>
                    <span className={classes.proposalVoteLabel}>{t("words.pixa_power")}</span>
                </div>
                <ExpandMoreIcon
                    className={`${classes.proposalChevron}${expanded ? ` ${classes.proposalChevronExpanded}` : ''}`}
                />
            </div>
            <Collapse in={expanded} timeout={320} mountOnEnter>
                <div className={classes.proposalBodyWrap}>
                    <div className={classes.proposalAuthorRow}>
                        <ButtonBase
                            style={{ borderRadius: "10px" }}
                            onClick={(e) => goAuthor(e, proposal.author)}
                        >
                            <div
                                className={`pixelated ${classes.proposalAuthorAvatar}`}
                                style={{ backgroundImage: cssBackgroundImage(avatarUrl) }}
                            />
                        </ButtonBase>
                        <div className={classes.proposalAuthorInfo}>
                            <span
                                className={classes.proposalAuthorName}
                                style={{ cursor: "pointer" }}
                                onClick={(e) => goAuthor(e, proposal.author)}
                            >@{proposal.author}</span>
                            {proposal.receiver && proposal.receiver !== proposal.author && (
                                <span
                                    className={classes.proposalReceiverName}
                                    style={{ cursor: "pointer" }}
                                    onClick={(e) => goAuthor(e, proposal.receiver)}
                                >{t("words.for_receiver", {
                                        receiver: proposal.receiver
                                    })}</span>
                            )}
                        </div>
                    </div>

                    {/* On-chain proposal body — sanitized via the same safeHTML path as BlogPostDialog */}
                    {bodyLoading ? (
                        <div className={classes.proposalContentSkeleton} aria-busy="true" aria-label={t("components.gdvmproposals.loading_proposal_content")}>
                            <Skeleton variant="text" width="92%" height={16} />
                            <Skeleton variant="text" width="98%" height={16} />
                            <Skeleton variant="text" width="85%" height={16} />
                            <Skeleton variant="text" width="70%" height={16} />
                        </div>
                    ) : body ? (
                        <div
                            className={classes.proposalContent}
                            dangerouslySetInnerHTML={{ __html: safeHTML(renderPostBody(api, body)) }}
                        />
                    ) : (
                        <div className={classes.proposalContentEmpty}>
                            {bodyError
                                ? "Couldn't load the proposal content — open the full proposal to read it."
                                : "This proposal has no description."}
                        </div>
                    )}

                    <div className={classes.proposalStatsRow}>
                        {StatBlock("Total Requested", fmtPXS(proposal.totalFunding), proposal.totalFunding)}
                        {StatBlock("Daily Pay", `${Math.round(proposal.dailyPay)} PXS`, Number(proposal.dailyPay))}
                        {StatBlock("Paid Out", fmtPXS(proposal.paidOut), proposal.paidOut)}
                        {StatBlock("Remaining", fmtPXS(proposal.remaining), proposal.remaining)}
                        <div className={classes.proposalStatBlock}>
                            <div className={classes.proposalStatBlockLabel}>{t("words.days_left")}</div>
                            <div className={classes.proposalStatBlockValue}>{proposal.daysRemaining}</div>
                        </div>
                    </div>

                    <div className={classes.proposalActions}>
                        <FormControlLabel
                            className={classes.voteCheckboxLabel}
                            control={
                                <Checkbox
                                    checked={!!voted}
                                    disabled={!canVote}
                                    onChange={(_e, checked) => onToggleVote(proposal.id, checked)}
                                    color="default"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            }
                            label={t("components.gdvmproposals.vote")}
                        />
                        <Button
                            className={classes.viewProposalButton}
                            startIcon={<Pageview />}
                            onClick={() => HISTORY.push(proposal.link)}
                        >
                            {t("words.view_proposal")}
                        </Button>
                    </div>
                </div>
            </Collapse>
        </Card>
    );
};

// ──────────────────────────────────────────────────────────────
// DpfStatsBox — DAO treasury summary + Create CTA. Placeholder figures
// until the live DPF read lands; each shows its FIAT equivalent.
// ──────────────────────────────────────────────────────────────
const DPF_DAILY_FUNDED = 97100;
const DPF_DAILY_BUDGET = 250000;
const DPF_TOTAL_BUDGET = 51300000;

const DpfStatsBox = ({ classes, fiatFor, onCreate }) => {
    const dpfStat = (label, pxsText, amount) => {
        const fiat = fiatFor ? fiatFor(amount) : null;
        return (
            <div className={classes.dpfStatItem}>
                <div className={classes.dpfStatLabel}>{label}</div>
                <div className={classes.dpfStatValue}>{pxsText}</div>
                {fiat ? <div className={classes.dpfStatFiat}>≈ {fiat}</div> : null}
            </div>
        );
    };

    return (
        <div className={classes.dpfStatsBox}>
            <div className={classes.dpfStatsHeader}>
                <span className={classes.dpfStatsTitle}>
                    {t("words.dao_treasury")}
                    <Tooltip
                        arrow
                        interactive
                        title={
                            <div className={classes.tooltip}>
                                {t("components.gdvmproposals.the_decentralized_pixa_fund_dpf_is_an")}
                            </div>
                        }
                    >
                        <InfoIcon className={classes.dpfInfoIcon} />
                    </Tooltip>
                </span>
            </div>
            <div className={classes.dpfStatsGrid}>
                {dpfStat("Daily Funded", "PXS 97.1K", DPF_DAILY_FUNDED)}
                {dpfStat("Daily Budget", "PXS 250.0K", DPF_DAILY_BUDGET)}
                {dpfStat("Total Budget", "PXS 51.3M", DPF_TOTAL_BUDGET)}
            </div>
            <Button
                className={classes.createProposalButton}
                startIcon={<AddIcon />}
                onClick={onCreate}
                variant="contained"
            >
                {t("components.gdvmproposals.create_proposal")}
            </Button>
        </div>
    );
};

// Placeholder cards shaped like the real collapsed proposal cards, shown while
// data loads so the panel keeps its layout when real content swaps in — no
// spinner→list jump, no layout shift. Skeleton supplies its own theme-aware
// shimmer, so no hardcoded colors here.
const renderLoadingSkeleton = (classes) => (
    <div aria-busy="true" aria-label={t("components.gdvmproposals.loading_proposals")} style={{ padding: "4px 0" }}>
        {[0, 1, 2, 3].map((i) => (
            <Card key={`sk-${i}`} className={classes.proposalCard}>
                <div className={classes.proposalHeader}>
                    <div className={classes.proposalMainInfo}>
                        <div className={classes.proposalTitleRow}>
                            <Skeleton variant="text" width={`${44 + (i % 3) * 14}%`} height={18} />
                            <Skeleton variant="text" width={26} height={18} />
                            <Skeleton variant="rect" width={54} height={16} style={{ borderRadius: 8 }} />
                        </div>
                        <div className={classes.proposalMeta} style={{ marginTop: 6 }}>
                            <Skeleton variant="text" width={210} height={13} />
                        </div>
                    </div>
                    <Skeleton variant="text" width={48} height={20} />
                </div>
            </Card>
        ))}
    </div>
);

const renderEmptyState = (classes, onCreate) => (
    <div className={classes.emptyWrap}>
        <InboxIcon className={classes.emptyIcon} />
        <Typography className={classes.emptyTitle}>
            {t("components.gdvmproposals.no_proposals_yet")}
        </Typography>
        <Typography className={classes.emptyText}>
            {t("components.gdvmproposals.the_dao_treasury_is_open_be_the")}
        </Typography>
        <Button
            className={classes.emptyCta}
            startIcon={<AddIcon />}
            onClick={onCreate}
        >
            {t("components.gdvmproposals.create_proposal")}
        </Button>
    </div>
);

// ──────────────────────────────────────────────────────────────
// ProposalsBody — presentational shell. It exists below the class's data
// orchestration purely so it can call the usePrices() hook (the parent is a
// class component, which cannot). One hook call here drives the live PXS→FIAT
// conversion fed to every card and the treasury box.
// ──────────────────────────────────────────────────────────────
const ProposalsBody = ({
                           classes, api, loading, active, pending, returnProposal,
                           myVotes, currentAccount, avatars, expandedId,
                           onExpandChange, onToggleVote, onCreate
                       }) => {
    const { pxsUsdPrice, formatFiat } = usePrices(api);
    const fiatFor = useCallback(
        (pxs) => {
            const n = Number(pxs);
            return (pxsUsdPrice > 0 && Number.isFinite(n)) ? formatFiat(n * pxsUsdPrice) : null;
        },
        [pxsUsdPrice, formatFiat]
    );

    const hasAny = active.length > 0 || pending.length > 0 || !!returnProposal;

    const renderList = (items) => items.map((proposal) => (
        <ProposalCard
            key={proposal.id}
            classes={classes}
            api={api}
            proposal={proposal}
            expanded={expandedId === proposal.id}
            onExpandChange={onExpandChange}
            voted={myVotes.has(proposal.id)}
            canVote={!!currentAccount}
            onToggleVote={onToggleVote}
            avatarUrl={avatars[proposal.author] || ''}
            fiatFor={fiatFor}
        />
    ));

    return (
        <>
            <DpfStatsBox classes={classes} fiatFor={fiatFor} onCreate={onCreate} />
            {loading ? (
                renderLoadingSkeleton(classes)
            ) : !hasAny ? (
                renderEmptyState(classes, onCreate)
            ) : (
                <>
                    {active.length > 0 && renderList(active)}

                    {/* Return proposal (dynamic threshold) — always between active & pending */}
                    {returnProposal && (
                        <ReturnProposalCard
                            classes={classes}
                            proposal={returnProposal}
                            voted={myVotes.has(returnProposal.id)}
                            canVote={!!currentAccount}
                            onToggleVote={onToggleVote}
                        />
                    )}

                    {pending.length > 0 && (
                        <Typography className={classes.sectionDivider}>
                            {t("components.gdvmproposals.pending_proposals")}
                        </Typography>
                    )}
                    {pending.length > 0 && renderList(pending)}
                </>
            )}
        </>
    );
};

class GDVMProposals extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            _loading: true,
            _active: [],
            _pending: [],
            _returnProposal: null,
            _avatars: {},            // { accountName: imageUrl }
            _myVotes: new Set(),     // proposal ids voted for by current user
            _currentAccount: null,
            _expandedId: null,       // only one accordion open at a time
        };
        this._mounted = false;
    }

    componentDidMount() {
        this._mounted = true;
        this._loadData();
    }

    componentDidUpdate(prevProps) {
        // Refetch if the api handle swaps in late.
        if (prevProps.api !== this.props.api) this._loadData();
    }

    componentWillUnmount() {
        this._mounted = false;
    }

    _loadData = async () => {
        const { api } = this.props;
        if (!api?.accounts) return;

        const currentAccount =
            api.sessionManager?.getCurrentAccountSync?.() ||
            api.sessionManager?.currentAccount ||
            null;

        try {
            // Chain A (proposals → author/receiver avatars) and Branch B (the
            // current user's proposal votes) are independent: B needs only
            // `currentAccount`, resolved synchronously above. They were previously
            // awaited back-to-back; now they run concurrently, so latency drops
            // from (A + B) to max(A, B). Branch B can be several paginated
            // round-trips for a heavy voter, so it was the bigger tail. Per-branch
            // error handling is unchanged: only Chain A's root read (listProposals)
            // can hard-fail the panel via the outer catch.

            // ── Chain A: all proposals → split → author/receiver avatars ────────
            const proposalsAndAvatars = (async () => {
                // Fetch all proposals ordered by votes descending, then split client-side
                // into active (funded) vs pending (votable but not yet funded).
                const list = await api.accounts.listProposals(
                    [], 100, 'by_total_votes', 'descending', 'all'
                );
                const mapped = (Array.isArray(list) ? list : []).map(mapProposal);

                // Proposal id 0 is the "return proposal" — the dynamic
                // funding threshold.  It lives in its own dedicated card.
                const returnProposal = mapped.find(p => p.id === 0) || null;
                const rest = mapped.filter(p => p.id !== 0);

                const active = rest.filter(p => p.status === 'active');
                const pending = rest.filter(p => p.status === 'pending' || p.status === 'expired');

                // Batch-fetch accounts to get profile images for authors/receivers
                let avatars = {};
                if (mapped.length > 0 && api.accounts?.getAccounts) {
                    const nameSet = new Set();
                    for (const p of mapped) {
                        if (p.author) nameSet.add(p.author);
                        if (p.receiver && p.receiver !== p.author) nameSet.add(p.receiver);
                    }
                    if (nameSet.size > 0) {
                        try {
                            const accs = await api.accounts.getAccounts([...nameSet]);
                            for (const acc of (accs || [])) {
                                if (acc?.name && acc?._profile?.profile_image) {
                                    avatars[acc.name] = acc._profile.profile_image;
                                }
                            }
                        } catch (e) {
                            console.warn('[GDVMProposals] getAccounts for avatars failed:', e?.message);
                        }
                    }
                }
                return { active, pending, returnProposal, avatars };
            })();

            // ── Branch B: current user's proposal votes (independent, paginated) ─
            const myVotesPromise = (async () => {
                // Fetch the current user's proposal votes so checkboxes reflect reality.
                // list_proposal_votes with order=by_voter_proposal and start=[voter]
                // returns votes sorted by (voter, proposal_id). We page in chunks of
                // 1000 until the voter changes or results run dry. Results include
                // votes on proposals of any status (status='all').
                let myVotes = new Set();
                if (currentAccount && api.accounts.listProposalVotes) {
                    const PAGE = 1000;
                    // Hard cap on pages so a misbehaving node can never loop us forever.
                    // 50 pages × 1000 = 50k votes — orders of magnitude beyond any real user.
                    const MAX_PAGES = 50;
                    let startArr = [currentAccount];
                    let lastPid = null;
                    let done = false;

                    for (let page = 0; page < MAX_PAGES && !done; page++) {
                        let batch;
                        try {
                            batch = await api.accounts.listProposalVotes(
                                startArr, PAGE, 'by_voter_proposal', 'ascending', 'all'
                            );
                        } catch (e) {
                            console.warn('[GDVMProposals] list_proposal_votes failed:', e?.message);
                            break;
                        }
                        if (!Array.isArray(batch) || batch.length === 0) break;

                        let advanced = false;
                        for (const rec of batch) {
                            if (rec?.voter !== currentAccount) {
                                // Walked past our voter — every remaining record belongs
                                // to someone else, so we can stop paginating entirely.
                                done = true;
                                break;
                            }
                            const pid = rec?.proposal?.proposal_id ?? rec?.proposal?.id ?? null;
                            // First row of a continuation page echoes the previous
                            // page's last row; skip it so we don't double-count.
                            if (pid != null && pid === lastPid) continue;
                            if (pid != null) {
                                myVotes.add(pid);
                                lastPid = pid;
                                advanced = true;
                            }
                        }

                        // Short page = end of data. No page advance = defensive break
                        // (shouldn't happen, but avoids infinite loop if the node
                        // returns a garbled continuation token).
                        if (batch.length < PAGE) break;
                        if (!advanced) break;
                        startArr = [currentAccount, lastPid];
                    }
                }
                return myVotes;
            })();

            const [{ active, pending, returnProposal, avatars }, myVotes] = await Promise.all([
                proposalsAndAvatars,
                myVotesPromise,
            ]);

            if (!this._mounted) return;
            this.setState({
                _loading: false,
                _active: active,
                _pending: pending,
                _returnProposal: returnProposal,
                _avatars: avatars,
                _myVotes: myVotes,
                _currentAccount: currentAccount
            }, () => this.forceUpdate());
        } catch (e) {
            console.warn('[GDVMProposals] list_proposals failed:', e?.message);
            if (!this._mounted) return;
            this.setState({ _loading: false }, () => this.forceUpdate());
        }
    }

    _handleExpandChange = (proposalId, isExpanded) => {
        // "Only one accordion proposal can be opened at a time":
        // opening a new one replaces whatever was open; closing sets to null.
        this.setState({
            _expandedId: isExpanded ? proposalId : null
        }, () => this.forceUpdate());
    }

    _handleToggleVote = async (proposalId, shouldApprove) => {
        const { api } = this.props;
        const { _currentAccount, _myVotes } = this.state;
        if (!api?.broadcast || !_currentAccount) return;

        // Optimistic flip so the UI feels instant
        const next = new Set(_myVotes);
        if (shouldApprove) next.add(proposalId); else next.delete(proposalId);
        this.setState({ _myVotes: next }, () => this.forceUpdate());

        try {
            await api.broadcast.updateProposalVotes(
                _currentAccount, [proposalId], !!shouldApprove
            );
        } catch (e) {
            console.warn('[GDVMProposals] vote toggle failed:', e?.message);
            // Roll back the optimistic change
            if (!this._mounted) return;
            this.setState({ _myVotes: _myVotes }, () => this.forceUpdate());
        }
    }

    render() {
        const { classes, api } = this.props;
        const {
            _loading, _active, _pending, _returnProposal,
            _myVotes, _currentAccount, _avatars, _expandedId
        } = this.state;

        return (
            <DialogContent className={classes.dialogContent}>
                <ProposalsBody
                    classes={classes}
                    api={api}
                    loading={_loading}
                    active={_active}
                    pending={_pending}
                    returnProposal={_returnProposal}
                    myVotes={_myVotes}
                    currentAccount={_currentAccount}
                    avatars={_avatars}
                    expandedId={_expandedId}
                    onExpandChange={this._handleExpandChange}
                    onToggleVote={this._handleToggleVote}
                    onCreate={() => HISTORY.push(PROPOSAL_CREATE_URL)}
                />
            </DialogContent>
        );
    }
}

export default withLanguage(withStyles(styles)(GDVMProposals));