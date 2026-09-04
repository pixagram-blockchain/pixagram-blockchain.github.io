import React, { PureComponent } from 'preact/compat';
import withStyles from "@material-ui/core/styles/withStyles";

// Lexical utilities
import {
    $getRoot,
    $getSelection,
    $isRangeSelection,
    $isTextNode,
    $createParagraphNode,
    $createTextNode,
    $createRangeSelection,
    $setSelection,
    FORMAT_TEXT_COMMAND,
    UNDO_COMMAND,
    REDO_COMMAND,
} from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $convertToMarkdownString } from '@lexical/markdown';

// Shared markdown loader (clears root, converts with GFM tables) and the
// transformer set that includes images
import { loadMarkdownIntoEditor, EDITOR_TRANSFORMERS, $setBlocksTypeSafe } from './lexicalConfig';
import { $createImageNode, isRenderableImageSrc } from '../../utils/lexical/ImageNode';
import { storeImageOnArweave } from '../../utils/arweaveImage';

// Micromark imports for preview
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';

// Material-UI imports
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";

import CloseIcon from "@material-ui/icons/Close";

import SwipeableViews from "react-swipeable-views";
import * as actions from "../../actions/utils";
import timeAgo from '../../utils/TimeAgo';

// Sub-components
import DraftManager from './DraftManager';
import EditorToolbar from './EditorToolbar';
import EditorSection from './EditorSection';
import SettingsPanel from './SettingsPanel';
import ActionButtons from './ActionButtons';
import DraftsDialog from './DraftsDialog';
import PreviewDialog from './PreviewDialog';
import { LinkDialog, ImageUrlDialog, ConfirmDialog, PasswordDialog } from './Dialogs';
import FormatMenus from './FormatMenus';
import GradientEditorDialog from "../../components/GradientEditorDialog";

// Import styles from sub-components
import { editorHeaderStyles } from './EditorHeader';
import { editorToolbarStyles } from './EditorToolbar';
import { editorSectionStyles } from './EditorSection';
import { coverImageUploadStyles } from './CoverImageUpload';
import { settingsPanelStyles } from './SettingsPanel';
import { draftCardStyles } from './DraftCard';
import { draftsDialogStyles } from './DraftsDialog';
import { previewDialogStyles } from './PreviewDialog';
import { dialogStyles } from './Dialogs';
import { formatMenuStyles } from './FormatMenus';

import { t, subscribe as subscribe_language } from "../../utils/text";
import { PROPOSALS_PORTAL } from "../../utils/constants";

// Hoisted so SwipeableViews receives stable references across renders
const SWIPE_SPRING_CONFIG = {tension: 450, friction: 60, duration: '120ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '5ms'};
const SWIPE_CONTAINER_STYLE = {minHeight: "100%", height: "100%", position: "relative"};

// Only these protocols may be inserted as links/images. Blocks javascript: etc.
// at the source — the published markdown is immutable once on-chain.
const SAFE_URL_PROTOCOLS = ['https:', 'http:', 'mailto:', 'ipfs:'];
const sanitizeUrl = (raw) => {
    if (!raw) return null;
    let url = raw.trim();
    if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
    try {
        const parsed = new URL(url);
        return SAFE_URL_PROTOCOLS.includes(parsed.protocol) ? parsed.href : null;
    } catch (e) {
        return null;
    }
};

// ── Proposals (ported from the retired TextEditorDialog) ─────────────────
// The single community whose posts are DAO proposals. When the selected
// community matches this id, the settings panel shows the "This is a
// proposal" checkbox and the proposal-config fields. The id itself is
// canonical and owned by utils/constants (PROPOSALS_PORTAL) — shared with
// GDVMProposals, the drawer menu and the Disruptions grid — and only
// aliased here.
const PROPOSAL_COMMUNITY_ID = PROPOSALS_PORTAL.id;

// Default proposal timing: starts 3 days from now (giving the chain time
// to confirm), runs for 30 days by default.
const PROPOSAL_DEFAULT_START_OFFSET_DAYS = 3;
const PROPOSAL_DEFAULT_DURATION_DAYS = 30;

const _addDays = (d, n) => {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
};

// Chain wants ISO strings like "2026-08-01T00:00:00" (no ms, no Z)
const _toChainDate = (d) => {
    if (!d || isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
        + `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};

// Exact inverse of _toChainDate: the chain stores UTC without the trailing
// "Z", so we re-attach it and let Date parse the instant. Feeding the result
// back through _toChainDate round-trips to the same string, and the picker
// shows the same calendar day the author originally chose.
const _fromChainDate = (s) => {
    if (!s || typeof s !== 'string') return null;
    const d = new Date(/Z$/.test(s) ? s : s + 'Z');
    return isNaN(d.getTime()) ? null : d;
};

// Pull the numeric amount out of a proposal's daily_pay, which comes back
// either as a legacy asset string ("100.000 PXS") or a nai object
// ({ amount, precision, nai }). Returns a plain decimal string for the input.
const _parseDailyPayAmount = (dp) => {
    if (dp == null) return '';
    if (typeof dp === 'string') {
        const n = parseFloat(dp.replace(/[^0-9.]/g, ''));
        return isFinite(n) ? String(n) : '';
    }
    if (typeof dp === 'object' && dp.amount != null) {
        const precision = Number(dp.precision) || 0;
        const n = Number(dp.amount) / Math.pow(10, precision);
        return isFinite(n) ? String(n) : '';
    }
    return '';
};

// Resolve the live on-chain proposal linked to a post. Proposals don't live
// on the post object — they reference it by (creator, permlink) — so we list
// the author's proposals (by_creator windows their entries to the front) and
// match on permlink. Returns the proposal object (carrying proposal_id,
// daily_pay, end_date, start_date) or null when none is found / on error.
const findProposalForPost = async (api, author, permlink) => {
    if (!api?.accounts?.listProposals || !author || !permlink) return null;
    const a = String(author).toLowerCase().trim();
    try {
        const res = await api.accounts.listProposals([a], 100, 'by_creator', 'ascending', 'all');
        const list = Array.isArray(res) ? res : (Array.isArray(res?.proposals) ? res.proposals : null);
        if (!list) return null;
        return list.find(p => p
            && String(p.creator || '').toLowerCase().trim() === a
            && p.permlink === permlink) || null;
    } catch (e) {
        console.warn('[Editor] proposal lookup failed:', e?.message);
        return null;
    }
};

// Single-pass word count without allocating an array of every word
const countWords = (text) => {
    let count = 0, inWord = false;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        const isSpace = c === 32 || (c >= 9 && c <= 13);
        if (isSpace) {
            inWord = false;
        } else if (!inWord) {
            count++;
            inWord = true;
        }
    }
    return count;
};

const styles = (theme) => ({
    // Main dialog styles
    dialog: {
        "& .MuiDialog-paper": {
            zIndex: theme.zIndex.drawer + 10,
            backgroundColor: "#0c0c0c",
            color: "#fff",
            [theme.breakpoints.down("sm")]: {
                margin: 0,
                maxWidth: "100%",
                maxHeight: "100%",
                width: "100%",
                height: "100%",
                borderRadius: 0
            },
            [theme.breakpoints.up("md")]: {
                maxWidth: "90vw",
                width: 1200,
                height: "85vh"
            }
        },
        "& .MuiBackdrop-root": {
            zIndex: theme.zIndex.drawer + 1,
            backdropFilter: "blur(9px) grayscale(1)",
            overflow: "hidden",
            userSelect: "none",
        },
    },
    tooltipRoot: {
        maxWidth: "min(75vw, 500px)",
        borderRadius: "16px",
        backgroundColor: "#dddddd !important",
        color: "#0e0e0e !important"
    },
    tooltip: {
        margin: "8px",
        display: "block",
        fontSize: "14px",
        lineHeight: "22px"
    },
    appBar: {
        backgroundColor: "transparent",
        boxShadow: "none",
        "& .MuiToolbar-root": {
            minHeight: 64,
            padding: "0 24px"
        }
    },
    contentArea: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
        padding: 0,
        overflow: "hidden",
        backgroundColor: "#0a0a0a",
        borderRadius: "0px 0px 28px 38px",
    },
    mainContainer: {
        display: "flex",
        flex: 1,
        overflow: "hidden",
        position: "relative",
        [theme.breakpoints.down("sm")]: {
            flexDirection: "column",
            overflow: "auto",
            "& div.react-swipeable-view-container > div": {
                minHeight: "100%",
                maxHeight: "100%"
            },
            "& > div:first-child": {
                height: "100%"
            }
        }
    },
    modeToggleButton: {
        position: "absolute",
        backgroundColor: "#fff",
        color: "#000",
        borderRadius: 24,
        padding: "8px 24px",
        margin: "12px 24px",
        textTransform: "none",
        fontWeight: 500,
        "&:hover": {
            backgroundColor: "#f0f0f0"
        }
    },
    tagsInput: {
        "& .MuiOutlinedInput-root": {
            color: "#fff",
            "& fieldset": {
                borderColor: "rgba(255,255,255,0.24)"
            },
            "&:hover fieldset": {
                borderColor: "rgba(255,255,255,0.48)"
            }
        },
        "& .MuiInputLabel-root": {
            color: "rgba(255,255,255,0.7)"
        }
    },
    draftAvatar: {
        backgroundColor: "rgba(255,255,255,0.1)",
        color: "#fff",
        width: 40,
        height: 40
    },

    // Merge all sub-component styles
    ...editorHeaderStyles(theme),
    ...editorToolbarStyles(theme),
    ...editorSectionStyles(theme),
    ...coverImageUploadStyles(theme),
    ...settingsPanelStyles(theme),
    ...draftCardStyles(theme),
    ...draftsDialogStyles(theme),
    ...previewDialogStyles(theme),
    ...dialogStyles(theme),
    ...formatMenuStyles(theme),
});

// Keystrokes typed inside the editor must not reach document-level hotkey
// listeners (e.g. feed keyboard navigation that opens a post on Enter).
// MUI dialogs are portals on document.body, so without this every keydown
// bubbles straight to document. Escape is allowed through so MUI's Modal
// can still close the dialog.
const stopKeyLeak = (e) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') e.stopPropagation();
};

// Hoisted static props — these were inline object literals in render(),
// re-allocated on every keystroke-driven render of the dialog (title /
// description / markdown-source edits and word-count ticks).
const KEY_LEAK_PAPER_PROPS = { onKeyDown: stopKeyLeak, onKeyUp: stopKeyLeak };
const APPBAR_TITLE_STYLE = { fontWeight: 500 };
const APPBAR_CAPTION_STYLE = { color: "rgba(255,255,255,0.6)" };

class LexicalTextEditorDialog extends PureComponent {

    // PureComponent — useLanguage() is a hook and unavailable here, and nothing
    // in props changes when the user switches language, so shouldComponentUpdate
    // would block the repaint anyway. Subscribe directly and force it.
    _unsubscribeLanguage = null;

    _subscribeLanguage() {
        if (this._unsubscribeLanguage) return;
        this._unsubscribeLanguage = subscribe_language(() => this.forceUpdate());
    }

    _unsubscribeLanguageIfNeeded() {
        if (this._unsubscribeLanguage) {
            this._unsubscribeLanguage();
            this._unsubscribeLanguage = null;
        }
    }
    constructor(props) {
        super(props);

        this.state = {
            editorMode: 'visual',
            markdownSource: '',
            initialMarkdown: '',
            title: "",
            description: "",
            tags: [],
            tab: 0,
            mobile: typeof window !== 'undefined' ? window.innerWidth <= 960 : false,
            currentDraftId: null,
            payout: "default",
            community: "",
            // Proposal state — only used when community === PROPOSAL_COMMUNITY_ID
            isProposal: false,
            // When editing an existing post that IS a proposal, this holds the
            // live on-chain proposal object (proposal_id, daily_pay, end_date…)
            // so we can surface payout / end-date edits and update it on save.
            editProposal: null,
            proposalStartDate: _addDays(new Date(), PROPOSAL_DEFAULT_START_OFFSET_DAYS),
            proposalEndDate: _addDays(new Date(), PROPOSAL_DEFAULT_START_OFFSET_DAYS + PROPOSAL_DEFAULT_DURATION_DAYS),
            proposalDailyPay: "100",
            activeAccount: null,
            userCommunities: [],
            isPublishing: false,
            // Raw SVG of the cover from the gradient editor — travels
            // on-chain in jsonMetadata.image at publish time (< 1 kB).
            svgContent: null,
            enableComments: true,
            enableMonetization: false,
            editOpened: false,
            formatMenuAnchor: null,
            headingMenuAnchor: null,
            listMenuAnchor: null,
            linkDialogOpen: false,
            linkUrl: "",
            linkSelectedText: "",
            hasTextSelection: false,
            previewDialogOpen: false,
            previewContent: '',
            draftsDialogOpen: false,
            drafts: [],
            draftsLoading: false,
            draftsSearchQuery: "",
            confirmDialogOpen: false,
            confirmDialogTitle: "",
            confirmDialogMessage: "",
            confirmDialogAction: null,
            passwordDialogOpen: false,
            passwordDialogTitle: "",
            passwordDialogValue: "",
            passwordDialogAction: null,
            imageUrlDialogOpen: false,
            gradientEditorOpen: false,
            imageUrlDialogValue: "",
            imageUploading: false,
            wordCount: 0,
            readingTime: 0,
            gradient: null,
            deleteConfirmDialogOpen: false,
            deleteConfirmDraftId: null,
            deleteConfirmDraftTitle: "",
            // Lexical state tracking
            activeFormats: {
                bold: false,
                italic: false,
                underline: false,
                strikethrough: false,
                code: false,
            },
            activeBlockType: 'paragraph',
        };

        this.editorRef = React.createRef();
        this.fileInputRef = React.createRef();
        this.draftManager = new DraftManager();
        this.autoSaveTimer = null;
        this.statsTimer = null;
        this.mediaQuery = null;
        // Unfiltered drafts list, cached when the drafts dialog loads, so
        // search keystrokes filter in memory instead of re-querying the
        // database (see handleDraftsSearch).
        this._allDrafts = [];
        // Last successful Lexical -> markdown serialization. Fallback for
        // saves that happen when the editor is unmounted (e.g. unmount flush),
        // so a detached ref can never overwrite a draft with empty content.
        this._lastMarkdown = '';
        // Grace-period close timers for the hover-opened sidebar menus,
        // keyed 'format' | 'heading' | 'list' (see holdMenu/releaseMenu).
        this._menuCloseTimers = {};
        // Range-selection snapshots taken before the link / image dialogs
        // open (the dialogs take focus, which would otherwise lose them).
        this._savedLinkSelection = null;
        this._savedImageSelection = null;
        // Selection snapshot taken when a sidebar menu opens — a menu item
        // click can land with the editor blurred, and this is what the
        // toggle handlers fall back to (same pattern as the link dialog).
        this._savedToolbarSelection = null;
        // Set after a successful broadcast: blocks the unmount-flush from
        // re-creating a draft for content that's already on-chain.
        this._published = false;
    }

    async componentDidMount() {
        this._subscribeLanguage();
        this.mediaQuery = window.matchMedia('(max-width: 960px)');
        if (this.mediaQuery.matches !== this.state.mobile) {
            this.setState({ mobile: this.mediaQuery.matches });
        }
        if (this.mediaQuery.addEventListener) {
            this.mediaQuery.addEventListener('change', this.handleMediaChange);
        } else {
            this.mediaQuery.addListener(this.handleMediaChange);
        }

        // ── EDIT MODE — the dialog edits an existing on-chain post.
        //    Drafts never apply here: restoring one would overwrite the
        //    post's actual content with unrelated local text.
        if (this.props.editPost) {
            if (this.props.open) this._loadEditPost();
        } else {
            const recent = await this.draftManager.getMostRecent();
            if (recent) {
                this.loadDraftData(recent);
            }
        }

        // Load active session and user communities (ported from the retired
        // TextEditorDialog): the community list is the set the logged-in
        // account has joined, with the current portal (initialCommunity)
        // prepended if it isn't among them.
        const { api } = this.props;
        if (api) {
            try {
                const activeAccount = await (api.sessionManager?.getActiveAccount?.() || api.getActiveAccount?.());
                if (activeAccount) {
                    this.setState({ activeAccount });

                    if (api.communities?.getSubscriptions) {
                        try {
                            const subscriptions = await api.communities.getSubscriptions(activeAccount);
                            let communities = [];
                            if (Array.isArray(subscriptions) && subscriptions.length > 0) {
                                communities = subscriptions.map(s => {
                                    if (Array.isArray(s)) {
                                        return { name: s[0], title: s[1] || s[0], role: s[2] || 'guest' };
                                    }
                                    return { name: s.name || s.community || '', title: s.title || s.name || '', role: s.role || 'guest' };
                                }).filter(c => c.name);
                            }

                            // If initialCommunity is set but not in subscriptions, prepend it
                            const { initialCommunity } = this.props;
                            if (initialCommunity && !communities.some(c => c.name === initialCommunity)) {
                                communities = [{ name: initialCommunity, title: initialCommunity, role: 'guest' }, ...communities];
                            }

                            this.setState({
                                userCommunities: communities,
                                community: initialCommunity || this.state.community || (communities.length > 0 ? communities[0].name : '')
                            });
                        } catch (e) {
                            console.warn('[Editor] Failed to load communities:', e.message);
                        }
                    }
                }
            } catch (e) {
                console.warn('[Editor] Failed to get active account:', e.message);
            }
        }
    }

    componentDidUpdate(prevProps) {
        // Uncontrolled mode: a parent may still hand over an initial cover
        // via the gradient prop without wiring a setter — seed it into state
        // when the dialog opens (same behavior as the retired editor).
        if (this.props.open && !prevProps.open &&
            typeof this.props.setGradient !== 'function' &&
            this.props.gradient && this.props.gradient !== this.state.gradient) {
            this.setState({ gradient: this.props.gradient });
        }

        // Pre-select community from props when dialog opens (create mode only —
        // in edit mode the community is locked to the post's parent_permlink)
        if (this.props.open && !prevProps.open && this.props.initialCommunity && !this.props.editPost) {
            this.setState({ community: this.props.initialCommunity });
        }

        // Reset _published when the dialog re-opens so a kept-mounted
        // instance can draft + publish again without stale state.
        if (this.props.open && !prevProps.open) {
            this._published = false;
        }

        // ── EDIT MODE — (re)load the on-chain version on every open so the
        //    editor always starts from the chain's current bytes, even when
        //    the lazy-mounted instance is reused across openings or the
        //    target post changed. ──
        if (this.props.editPost && this.props.open
            && (!prevProps.open
                || (prevProps.editPost || {}).permlink !== this.props.editPost.permlink
                || (prevProps.editPost || {}).author !== this.props.editPost.author)) {
            this._loadEditPost();
        }
    }

    /**
     * EDIT MODE loader — fetch the RAW on-chain version of the post being
     * edited (un-sanitized body + metadata string) and hydrate the editor
     * exactly like loadDraftData does for drafts: state first, then push the
     * markdown into the already-mounted Lexical instance.
     */
    _loadEditPost = async () => {
        const { api, editPost } = this.props;
        if (!api?.content || !editPost?.author || !editPost?.permlink) return;
        try {
            const raw = await api.content.getContent(editPost.author, editPost.permlink, { raw: true });
            // The dialog may have been closed or retargeted while fetching.
            if (!this.props.open || !this.props.editPost
                || this.props.editPost.permlink !== editPost.permlink) return;
            if (!raw || !raw.author) {
                actions.trigger_snackbar(t("components.lexical_text_editor_dialog.could_not_load_the_post_for_editing"));
                return;
            }

            let meta = {};
            try {
                const parsed = JSON.parse(raw.json_metadata || '{}');
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) meta = parsed;
            } catch (_) { meta = {}; }

            const body = raw.body || '';
            const metaTags = Array.isArray(meta.tags)
                ? meta.tags.filter(t => typeof t === 'string')
                : [];
            this.setState({
                title: raw.title || '',
                description: typeof meta.description === 'string' ? meta.description : '',
                // Community = category = parent_permlink — immutable on edits.
                community: raw.parent_permlink || '',
                markdownSource: body,
                initialMarkdown: body,
                currentDraftId: null,
                isProposal: false,
                editProposal: null,
                // The existing cover only previews; it's re-broadcast solely
                // when the user replaces it (svgContent stays null).
                svgContent: null,
            });
            if (typeof meta.image === 'string' && meta.image) {
                this._setGradient(meta.image);
            }

            // Push into the already-mounted Lexical editor (the
            // InitializePlugin only runs once per mount, so a kept-mounted
            // instance must be updated imperatively — same as loadDraftData).
            const editor = this.editorRef.current;
            if (editor) {
                loadMarkdownIntoEditor(editor, body);
            }

            // ── Proposal detection — if the post is flagged as a DAO proposal
            //    (or lives in the proposals community), resolve the live
            //    proposal so its payout / end-date become editable. We only
            //    hit the chain when there's a hint, sparing ordinary edits the
            //    extra call. A missing proposal (expired/removed) simply leaves
            //    the proposal fields hidden — there's nothing to update.
            const looksLikeProposal = meta.proposal === true
                || (raw.parent_permlink || '') === PROPOSAL_COMMUNITY_ID
                || metaTags.some(t => String(t).toLowerCase() === 'proposal');
            if (looksLikeProposal) {
                const proposal = await findProposalForPost(api, editPost.author, editPost.permlink);
                // The dialog may have been closed or retargeted while fetching.
                if (proposal && this.props.open && this.props.editPost
                    && this.props.editPost.permlink === editPost.permlink) {
                    this.setState({
                        editProposal: proposal,
                        isProposal: true,
                        proposalDailyPay: _parseDailyPayAmount(proposal.daily_pay) || this.state.proposalDailyPay,
                        proposalEndDate: _fromChainDate(proposal.end_date) || this.state.proposalEndDate,
                        proposalStartDate: _fromChainDate(proposal.start_date) || this.state.proposalStartDate,
                    });
                }
            }
        } catch (e) {
            console.warn('[Editor] edit load failed:', e?.message);
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.could_not_load_the_post_for_editing"));
        }
    };

    componentWillUnmount() {
        this._unsubscribeLanguageIfNeeded();
        if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
        if (this.statsTimer) clearTimeout(this.statsTimer);
        Object.keys(this._menuCloseTimers).forEach((key) => {
            if (this._menuCloseTimers[key]) clearTimeout(this._menuCloseTimers[key]);
        });
        if (this.mediaQuery) {
            if (this.mediaQuery.removeEventListener) {
                this.mediaQuery.removeEventListener('change', this.handleMediaChange);
            } else {
                this.mediaQuery.removeListener(this.handleMediaChange);
            }
        }
        // Don't re-create a draft for content that was already published —
        // and never turn an on-chain post being edited into a local draft.
        if (!this._published && !this.props.editPost) {
            this.saveDraft();
        }
    }

    handleMediaChange = (e) => this.setState({ mobile: e.matches });

    loadDraftData(draft) {
        try {
            const proposal = draft.settings?.proposal || {};
            const defaultStart = _addDays(new Date(), PROPOSAL_DEFAULT_START_OFFSET_DAYS);
            const defaultEnd = _addDays(defaultStart, PROPOSAL_DEFAULT_DURATION_DAYS);

            this.setState({
                markdownSource: draft.content || '',
                initialMarkdown: draft.content || '',
                title: draft.title || '',
                description: draft.description || '',
                tags: draft.tags || [],
                currentDraftId: draft._id,
                payout: draft.settings?.payout || 'default',
                community: draft.settings?.community || this.state.community || '',
                isProposal: !!proposal.isProposal,
                proposalStartDate: proposal.startDate ? new Date(proposal.startDate) : defaultStart,
                proposalEndDate: proposal.endDate ? new Date(proposal.endDate) : defaultEnd,
                proposalDailyPay: proposal.dailyPay || '100',
                lastSaved: draft.lastModified
            });

            this._lastMarkdown = draft.content || '';

            // Load content into the live Lexical editor.
            // loadMarkdownIntoEditor clears the root first, so loading
            // draft B over draft A replaces instead of appending.
            const editor = this.editorRef.current;
            if (editor) {
                loadMarkdownIntoEditor(editor, draft.content || '');
            }

            if ((draft.gradient || null) !== this._getGradient()) {
                this._setGradient(draft.gradient || null);
            }
        } catch (error) {
            console.error('Error loading draft:', error);
        }
    }

    getEditorMarkdown = () => {
        const { editorMode, markdownSource } = this.state;

        if (editorMode === 'markdown') {
            return markdownSource;
        }

        const editor = this.editorRef.current;
        if (!editor) return this._lastMarkdown;

        let markdown = '';
        editor.getEditorState().read(() => {
            markdown = $convertToMarkdownString(EDITOR_TRANSFORMERS);
        });
        this._lastMarkdown = markdown;
        return markdown;
    };

    async saveDraft(showNotification = false) {
        // Never persist an on-chain post being edited as a local draft.
        if (this.props.editPost) return null;
        const {
            currentDraftId, editorMode, markdownSource, title, description, tags,
            community, payout,
            isProposal, proposalStartDate, proposalEndDate, proposalDailyPay
        } = this.state;
        const gradient = this._getGradient();

        const content = this.getEditorMarkdown();

        const plainText = content.replace(/[#*_\[\]()]/g, '').trim();

        if (!title.trim() && !plainText.trim()) return null;

        const wordCount = countWords(plainText);

        const draftId = await this.draftManager.save(currentDraftId, {
            title: title || t("components.lexical_text_editor_dialog.untitled"),
            description,
            content,
            tags,
            gradient,
            wordCount,
            settings: {
                payout,
                community,
                proposal: {
                    isProposal: !!isProposal,
                    startDate: proposalStartDate ? proposalStartDate.toISOString() : null,
                    endDate: proposalEndDate ? proposalEndDate.toISOString() : null,
                    dailyPay: proposalDailyPay || '0',
                }
            }
        });

        if (draftId) {
            this.setState({
                currentDraftId: draftId,
                lastSaved: Date.now()
            });

            if (showNotification) {
                actions.trigger_snackbar(t("components.lexical_text_editor_dialog.draft_saved"));
            }
        }

        return draftId;
    }

    scheduleAutoSave() {
        if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => this.saveDraft(), 2000);
    }

    onChange = () => {
        // Content changed: refresh stats (debounced) and schedule autosave.
        // Toolbar format/block state is tracked by ToolbarStatePlugin, which
        // also fires on cursor moves and only when something actually changed.
        this.scheduleStatsUpdate();
        this.scheduleAutoSave();
    };

    scheduleStatsUpdate() {
        if (this.statsTimer) clearTimeout(this.statsTimer);
        this.statsTimer = setTimeout(() => this.updateStats(), 300);
    }

    onToolbarStateChange = (activeFormats, activeBlockType, hasTextSelection) => {
        this.setState({ activeFormats, activeBlockType, hasTextSelection: Boolean(hasTextSelection) });
    };

    onMarkdownChange = (e) => {
        const markdownSource = e.target.value;
        this.setState({ markdownSource });
        this.scheduleStatsUpdate();
        this.scheduleAutoSave();
    };

    toggleEditorMode = () => {
        const { editorMode, markdownSource } = this.state;

        if (editorMode === 'visual') {
            // Visual -> Markdown: export current content (also refreshes cache)
            this.setState({
                editorMode: 'markdown',
                markdownSource: this.getEditorMarkdown()
            });
        } else {
            // Markdown -> Visual: set initialMarkdown to trigger re-init
            this._lastMarkdown = markdownSource;
            this.setState({
                editorMode: 'visual',
                initialMarkdown: markdownSource
            });
        }
    };

    updateStats() {
        const { editorMode, markdownSource, wordCount, readingTime } = this.state;

        let text = '';
        if (editorMode === 'markdown') {
            text = markdownSource.replace(/[#*_\[\]()]/g, '');
        } else {
            const editor = this.editorRef.current;
            if (editor) {
                editor.getEditorState().read(() => {
                    text = $getRoot().getTextContent();
                });
            }
        }

        const words = countWords(text);
        const minutes = Math.ceil(words / 200);
        if (words !== wordCount || minutes !== readingTime) {
            this.setState({ wordCount: words, readingTime: minutes });
        }
    }

    createNewDraft = async () => {
        await this.saveDraft();

        this._lastMarkdown = '';
        this.setState({
            draftsDialogOpen: false,
            markdownSource: '',
            initialMarkdown: '',
            title: '',
            description: '',
            tags: [],
            currentDraftId: null,
            lastSaved: null,
            editorMode: 'visual'
        });

        // Clear the Lexical editor
        const editor = this.editorRef.current;
        if (editor) {
            editor.update(() => {
                const root = $getRoot();
                root.clear();
                root.append($createParagraphNode());
            });
        }

        this._setGradient(null);

        actions.trigger_snackbar(t("components.lexical_text_editor_dialog.new_draft_created"));
    };

    loadDraft = async (draftId) => {
        await this.saveDraft();
        const draft = await this.draftManager.get(draftId);
        if (draft) {
            this.loadDraftData(draft);
            this.setState({ draftsDialogOpen: false });
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.draft_loaded"));
        }
    };

    async deleteDraft(draftId) {
        const success = await this.draftManager.delete(draftId);
        if (success) {
            if (this.state.currentDraftId === draftId) {
                await this.createNewDraft();
                this.setState({ draftsDialogOpen: true }); // Keep drafts dialog open
            }
            await this.loadDrafts();
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.draft_deleted"));
        }
    }

    // Case-insensitive title/description filter over a drafts list. The
    // query is lowercased ONCE per call — the old inline filter lowercased
    // it twice per draft, on every keystroke.
    filterDrafts = (drafts, query) => {
        if (!query) return drafts;
        const q = query.toLowerCase();
        return drafts.filter(d =>
            d.title?.toLowerCase().includes(q) ||
            d.description?.toLowerCase().includes(q)
        );
    };

    async loadDrafts() {
        this.setState({ draftsLoading: true });
        const drafts = await this.draftManager.getAll();
        // Cache the unfiltered list; handleDraftsSearch filters this in
        // memory. Refreshed on dialog open and after create/delete.
        this._allDrafts = drafts;
        this.setState({
            drafts: this.filterDrafts(drafts, this.state.draftsSearchQuery),
            draftsLoading: false
        });
    }

    showConfirmDialog = (title, message, action) => {
        this.setState({
            confirmDialogOpen: true,
            confirmDialogTitle: title,
            confirmDialogMessage: message,
            confirmDialogAction: action
        });
    };

    closeConfirmDialog = () => {
        this.setState({
            confirmDialogOpen: false,
            confirmDialogAction: null
        });
    };

    handleConfirmAction = () => {
        if (this.state.confirmDialogAction) {
            this.state.confirmDialogAction();
        }
        this.closeConfirmDialog();
    };

    showPasswordDialog = (title, action) => {
        this.setState({
            passwordDialogOpen: true,
            passwordDialogTitle: title,
            passwordDialogValue: "",
            passwordDialogAction: action
        });
    };

    closePasswordDialog = () => {
        this.setState({
            passwordDialogOpen: false,
            passwordDialogAction: null,
            passwordDialogValue: ""
        });
    };

    handlePasswordAction = () => {
        if (this.state.passwordDialogAction) {
            this.state.passwordDialogAction(this.state.passwordDialogValue);
        }
        this.closePasswordDialog();
    };

    showImageUrlDialog = () => {
        this.setState({
            imageUrlDialogOpen: true,
            imageUrlDialogValue: "https://"
        });
    };

    closeImageUrlDialog = () => {
        this.setState({
            imageUrlDialogOpen: false,
            imageUrlDialogValue: ""
        });
    };

    handleImageUrlInsert = () => {
        const url = this.state.imageUrlDialogValue;
        if (url && url.trim() && url !== "https://") {
            this.insertImageUrl(url);
        }
        this.closeImageUrlDialog();
    };

    openDraftsDialog = async () => {
        await this.saveDraft(false);
        this.setState({ draftsDialogOpen: true });
        await this.loadDrafts();
    };

    closeDraftsDialog = () => {
        this.setState({
            draftsDialogOpen: false,
            draftsSearchQuery: '',
            filterTags: [],
            filterStatus: null
        });
    };

    handleDraftsSearch = (e) => {
        const draftsSearchQuery = e.target.value;
        // Filter the cached list synchronously: it's capped at 50 drafts, so
        // the old debounce → database round-trip → loading-spinner cycle per
        // keystroke bought nothing. Results now update in the same render as
        // the input, with zero I/O.
        this.setState({
            draftsSearchQuery,
            drafts: this.filterDrafts(this._allDrafts, draftsSearchQuery)
        });
    };

    // Delete confirmation handlers
    showDeleteConfirmDialog = (draftId, draftTitle) => {
        this.setState({
            deleteConfirmDialogOpen: true,
            deleteConfirmDraftId: draftId,
            deleteConfirmDraftTitle: draftTitle || t("components.lexical_text_editor_dialog.untitled_draft")
        });
    };

    closeDeleteConfirmDialog = () => {
        this.setState({
            deleteConfirmDialogOpen: false,
            deleteConfirmDraftId: null,
            deleteConfirmDraftTitle: ""
        });
    };

    handleDeleteConfirm = async () => {
        const { deleteConfirmDraftId } = this.state;
        if (deleteConfirmDraftId) {
            await this.deleteDraft(deleteConfirmDraftId);
        }
        this.closeDeleteConfirmDialog();
    };

    formatDate = (timestamp) => {
        return timeAgo.format(timestamp || Date.now());
    };

    focus = () => {
        const editor = this.editorRef.current;
        if (editor) {
            editor.focus();
        }
    };

    // Lexical formatting methods
    toggleInlineStyle = (format) => {
        const editor = this.editorRef.current;
        if (!editor) return;
        // A format-menu click may arrive with the editor blurred; put the
        // selection captured at menu-open back before the command reads it.
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) && this._savedToolbarSelection) {
                this._restoreSelection(this._savedToolbarSelection);
            }
        });
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    };

    toggleBlockType = (type) => {
        const editor = this.editorRef.current;
        if (!editor) return;

        editor.update(() => {
            let selection = $getSelection();
            // A sidebar-menu click can land with the editor blurred (the
            // menu took focus) — fall back to the selection captured when
            // the menu opened, same pattern as the link/image dialogs.
            if (!$isRangeSelection(selection) && this._savedToolbarSelection) {
                this._restoreSelection(this._savedToolbarSelection);
                selection = $getSelection();
            }
            if (!$isRangeSelection(selection)) return;

            if (type === 'bullet') {
                editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            } else if (type === 'number') {
                editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            } else if (type === 'quote') {
                $setBlocksTypeSafe(selection, () => $createQuoteNode());
            } else if (type === 'code') {
                $setBlocksTypeSafe(selection, () => $createCodeNode());
            } else if (type === 'paragraph') {
                $setBlocksTypeSafe(selection, () => $createParagraphNode());
            } else if (type.startsWith('h')) {
                $setBlocksTypeSafe(selection, () => $createHeadingNode(type));
            }
        });
    };

    // hasInlineStyle / hasBlockType used to live here as stable accessor
    // functions handed to EditorToolbar. That was a stale-render bug: the
    // function identities never changed while they read fresh state at call
    // time, so when activeFormats/activeBlockType DID change, the toolbar's
    // React.memo saw identical props and served its cached render — the
    // active bold/italic/quote highlighting never updated. The state itself
    // is now passed as props (see render), so the memo re-renders exactly on
    // real toolbar transitions and never otherwise.

    // ── Selection snapshots across modal dialogs ────────────────────────
    // Opening the link/image dialog focuses its text field, which blurs the
    // editor; the DOM selection is gone by the time Insert is pressed.
    // These helpers snapshot the Lexical range selection as plain
    // anchor/focus points on open and rebuild it on insert.
    _captureSelection = () => {
        const editor = this.editorRef.current;
        if (!editor) return null;

        let captured = null;
        editor.getEditorState().read(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            captured = {
                anchor: {
                    key: selection.anchor.key,
                    offset: selection.anchor.offset,
                    type: selection.anchor.type,
                },
                focus: {
                    key: selection.focus.key,
                    offset: selection.focus.offset,
                    type: selection.focus.type,
                },
                collapsed: selection.isCollapsed(),
                text: selection.getTextContent(),
                hasTextNodes: selection.getNodes().some($isTextNode),
            };
        });
        return captured;
    };

    // Must be called inside editor.update().
    _restoreSelection = (points) => {
        if (!points) return;
        try {
            const selection = $createRangeSelection();
            selection.anchor.set(points.anchor.key, points.anchor.offset, points.anchor.type);
            selection.focus.set(points.focus.key, points.focus.offset, points.focus.type);
            $setSelection(selection);
        } catch (e) {
            // Referenced nodes were removed since capture — leave the
            // current selection (whatever Lexical retained) in place.
        }
    };

    // Links are only created FROM selected text. The toolbar button and the
    // radial menu item are disabled without a selection; Ctrl+K (and any
    // other stray path) lands here and explains itself instead.
    openLinkDialog = () => {
        const captured = this._captureSelection();
        if (!captured || captured.collapsed || !captured.hasTextNodes || !captured.text.trim()) {
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.select_some_text_to_link_first"));
            return;
        }

        this._savedLinkSelection = captured;
        this.setState({
            linkDialogOpen: true,
            linkSelectedText: captured.text,
            linkUrl: ""
        });
    };

    closeLinkDialog = () => {
        this._savedLinkSelection = null;
        this.setState({
            linkDialogOpen: false,
            linkUrl: "",
            linkSelectedText: ""
        });
    };

    insertLink = () => {
        const { linkUrl } = this.state;
        const editor = this.editorRef.current;
        if (!editor || !linkUrl || !linkUrl.trim()) return;

        const url = sanitizeUrl(linkUrl);
        if (!url) {
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.invalid_or_unsupported_link_url"));
            return;
        }

        const points = this._savedLinkSelection;
        // Rebuild the selection captured when the dialog opened, then let
        // the LinkPlugin wrap it.
        editor.update(() => {
            this._restoreSelection(points);
        });
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);

        this.closeLinkDialog();
        setTimeout(() => editor.focus(), 0);
    };

    insertImage = () => {
        // Snapshot the caret before the URL dialog steals focus, so the
        // image lands where the user actually was.
        this._savedImageSelection = this._captureSelection();
        this.showImageUrlDialog();
    };

    insertImageUrl = (url) => {
        const safe = sanitizeUrl(url);
        if (!safe) {
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.invalid_or_unsupported_image_url"));
            return;
        }

        const editor = this.editorRef.current;
        if (!editor) return;

        const points = this._savedImageSelection;
        this._savedImageSelection = null;

        // https renders as a real ImageNode (serialized back to `![alt](url)`
        // on save / mode switch / preview / publish); anything else is kept
        // as literal markdown text — the same rule as typing/pasting/import.
        editor.update(() => {
            this._restoreSelection(points);
            const node = isRenderableImageSrc(safe)
                ? $createImageNode({ src: safe, altText: 'Image' })
                : $createTextNode(`![Image](${safe})`);
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                selection.insertNodes([node]);
            } else {
                // Editor was never focused (no caret): append at the end
                // instead of silently dropping the insert.
                const paragraph = $createParagraphNode();
                paragraph.append(node);
                $getRoot().append(paragraph);
            }
        });
        setTimeout(() => editor.focus(), 0);
    };

    // ── Arweave image uploads ───────────────────────────────────────────
    // Local files (picked in the image dialog, dropped into the editor, or
    // pasted from the clipboard) are encoded by utils/arweaveImage per the
    // policy there (WebP, ≤99 kB targets Turbo's free tier) and stored on
    // Arweave. The gateway URL is https, so the result renders as a real
    // ImageNode under the editor's image rule and round-trips as markdown.
    handleImageFileSelected = (file) => {
        // Caret was captured when the image dialog opened (insertImage).
        this._insertArweaveImage(file, this._savedImageSelection);
    };

    handleDroppedImageFiles = (files) => {
        // Lexical moved the caret to the drop/paste point before dispatching
        // DRAG_DROP_PASTE — snapshot it now, the upload is async.
        this._insertArweaveImage(files && files[0], this._captureSelection());
    };

    _insertArweaveImage = async (file, points) => {
        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.only_image_files_can_be_uploaded"));
            return;
        }
        if (this.state.imageUploading) return;

        this.setState({ imageUploading: true });
        actions.trigger_snackbar(t("components.lexical_text_editor_dialog.uploading_image_to_arweave"));
        try {
            // Auth headers for the Worker (posting-key signature / dev
            // token) plug in here if the endpoint requires them:
            // storeImageOnArweave(file, { headers: { ... } })
            const stored = await storeImageOnArweave(file);

            const editor = this.editorRef.current;
            if (editor) {
                editor.update(() => {
                    this._restoreSelection(points);
                    const altText = (file.name || 'Image').replace(/\.[^.]+$/, '') || 'Image';
                    const node = $createImageNode({ src: stored.url, altText });
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        selection.insertNodes([node]);
                    } else {
                        const paragraph = $createParagraphNode();
                        paragraph.append(node);
                        $getRoot().append(paragraph);
                    }
                });
                setTimeout(() => editor.focus(), 0);
            }

            this._savedImageSelection = null;
            this.setState({
                imageUploading: false,
                imageUrlDialogOpen: false,
                imageUrlDialogValue: ""
            });
            actions.trigger_snackbar(
                `Image stored on Arweave (${Math.max(1, Math.round(stored.bytes / 1024))} kB${stored.withinFreeBudget ? ', free tier' : ''})`
            );
        } catch (error) {
            console.error('Arweave image upload failed:', error);
            this.setState({ imageUploading: false });
            actions.trigger_snackbar(
                'Image upload failed: ' + (error && error.message ? error.message : 'unknown error')
            );
        }
    };

    // Cover gradient lives in component state — the pattern the retired
    // TextEditorDialog used, and the reason it never crashed: its mount
    // points didn't pass gradient props either. If a parent DOES control it
    // (gradient + setGradient prop pair), that pair wins; otherwise the
    // dialog owns the value itself.
    _getGradient = () => (
        typeof this.props.setGradient === 'function'
            ? this.props.gradient
            : this.state.gradient
    );

    _setGradient = (value) => {
        if (typeof this.props.setGradient === 'function') {
            this.props.setGradient(value);
        } else {
            this.setState({ gradient: value });
        }
    };

    handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            this._setGradient(event.target.result);
            this.setState({ svgContent: null });
        };
        reader.readAsDataURL(file);
    };

    removeCoverImage = () => {
        this._setGradient(null);
        this.setState({ svgContent: null });
    };

    handleSave = async () => {
        const draftId = await this.saveDraft(true);
        if (!draftId) return;
    };

    openPreview = () => {
        // Serialize once, here — not on every render.
        this.setState({
            previewContent: this.getEditorMarkdown(),
            previewDialogOpen: true
        });
    };

    closePreview = () => {
        this.setState({ previewDialogOpen: false });
    };

    // Real publish, ported (create mode) from the retired TextEditorDialog:
    // validates, broadcasts the comment op, deletes the local draft, then —
    // for proposals — fires create_proposal referencing the fresh permlink.
    // The old stub here only saved a draft, which is why Publish used to
    // answer with t("components.lexical_text_editor_dialog.draft_saved").
    handlePublish = async () => {
        const { api } = this.props;
        const {
            activeAccount, title, description, community, svgContent,
            isProposal, proposalStartDate, proposalEndDate, proposalDailyPay,
        } = this.state;

        if (!activeAccount || !api) {
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.please_log_in_first"));
            return;
        }
        if (!title.trim()) {
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.title_is_required"));
            return;
        }

        // ════════════════════════════════════════════════════════════════
        // EDIT MODE — update an existing on-chain post in place.
        // Same permlink + same parent ⇒ the chain treats the broadcast as
        // an edit; api.broadcast.updateComment computes the diff-match-patch
        // against the raw on-chain body and sends whichever is smaller.
        // Community, payout and proposals are immutable/irrelevant here.
        // ════════════════════════════════════════════════════════════════
        if (this.props.editPost) {
            const { author, permlink: editPermlink } = this.props.editPost;
            const { editProposal } = this.state;
            if (activeAccount !== author) {
                actions.trigger_snackbar(`Only @${author} can edit this post.`);
                return;
            }

            // ── If this post is a proposal, validate the proposal fields BEFORE
            //    we touch the post, so a bad value never leaves the post patched
            //    while the proposal op bails. update_proposal can change the
            //    payout (lower-only) and the end date; nothing else.
            let proposalUpdate = null;
            if (editProposal) {
                const end = proposalEndDate instanceof Date ? proposalEndDate : new Date(proposalEndDate);
                const start = _fromChainDate(editProposal.start_date);
                const daily = Number(proposalDailyPay);
                const origDaily = Number(_parseDailyPayAmount(editProposal.daily_pay));

                if (isNaN(end.getTime())) {
                    actions.trigger_snackbar(t("components.lexical_text_editor_dialog.proposal_end_date_is_required"));
                    return;
                }
                if (start && end.getTime() <= start.getTime()) {
                    actions.trigger_snackbar(t("components.lexical_text_editor_dialog.proposal_end_date_must_be_after_the"));
                    return;
                }
                if (!isFinite(daily) || daily <= 0) {
                    actions.trigger_snackbar(t("components.lexical_text_editor_dialog.daily_pay_must_be_greater_than_zero"));
                    return;
                }
                // The chain rejects raising daily_pay; catch it here with a clear
                // message instead of a cryptic broadcast failure.
                if (isFinite(origDaily) && daily > origDaily + 1e-9) {
                    actions.trigger_snackbar(`Daily pay can only be lowered (currently ${origDaily} PXS/day).`);
                    return;
                }
                proposalUpdate = {
                    proposalId: editProposal.proposal_id != null ? editProposal.proposal_id : editProposal.id,
                    creator: author,
                    dailyPay: `${daily.toFixed(3)} PXS`,
                    subject: (description || title || '').slice(0, 80),
                    permlink: editPermlink,
                    endDate: _toChainDate(end),
                };
            }

            this.setState({ isPublishing: true });
            let postUpdated = false;
            try {
                const content = this.getEditorMarkdown();
                // Metadata: only the fields this editor owns. Tags, license,
                // app/format etc. survive untouched via the shallow merge —
                // tag/NSFW/deleted edits live in the Edit-details dialog.
                const metaPatch = { description: description || '' };
                if (svgContent) {
                    const encoded = btoa(unescape(encodeURIComponent(svgContent)));
                    metaPatch.image = `data:image/svg+xml;base64,${encoded}`;
                }
                await api.broadcast.updateComment({
                    author,
                    permlink: editPermlink,
                    title: title.trim(),
                    body: content,
                    jsonMetadata: metaPatch,
                });
                postUpdated = true;

                // Post patched — now push the proposal changes (payout / end date).
                if (proposalUpdate) {
                    await api.broadcast.updateProposal(proposalUpdate);
                }

                this._published = true; // no draft resurrection on unmount
                this.setState({ isPublishing: false });
                this.closePreview();
                actions.trigger_snackbar(proposalUpdate
                    ? t("components.lexical_text_editor_dialog.post_and_proposal_updated_successfully")
                    : t("components.lexical_text_editor_dialog.post_updated_successfully"));
                this.props.onUpdated?.({ author, permlink: editPermlink, title: title.trim() });
                setTimeout(() => {
                    if (this.props.onClose) this.props.onClose();
                }, 1500);
            } catch (error) {
                console.error('Error updating post:', error);
                this.setState({ isPublishing: false });
                // The post may already be on-chain when only the proposal op
                // failed — say so distinctly so the user isn't misled into
                // thinking their content edits were lost.
                if (postUpdated && proposalUpdate) {
                    this._published = true;
                    this.closePreview();
                    this.props.onUpdated?.({ author, permlink: editPermlink, title: title.trim() });
                    actions.trigger_snackbar(error.message
                        ? `Post updated, but the proposal update failed: ${error.message}`
                        : t("components.lexical_text_editor_dialog.post_updated_but_the_proposal_update_failed_2"));
                } else {
                    actions.trigger_snackbar(error.message || t("components.lexical_text_editor_dialog.failed_to_update_post"));
                }
            }
            return;
        }

        if (!community) {
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.please_select_a_community"));
            return;
        }

        // ── Proposal-mode sanity checks, run BEFORE we broadcast the post.
        // Rejecting here avoids the half-broken state where a post is
        // published but the create_proposal op fails validation locally.
        const wantsProposal = !!isProposal && community === PROPOSAL_COMMUNITY_ID;
        if (wantsProposal) {
            const start = proposalStartDate instanceof Date ? proposalStartDate : new Date(proposalStartDate);
            const end = proposalEndDate instanceof Date ? proposalEndDate : new Date(proposalEndDate);
            const daily = Number(proposalDailyPay);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                actions.trigger_snackbar(t("components.lexical_text_editor_dialog.proposal_start_and_end_dates_are_required"));
                return;
            }
            if (end.getTime() <= start.getTime()) {
                actions.trigger_snackbar(t("components.lexical_text_editor_dialog.proposal_end_date_must_be_after_the"));
                return;
            }
            // Chain rejects start dates in the past (and allows ~now + a few
            // minutes). A 1-minute floor accounts for round-trip latency.
            if (start.getTime() < Date.now() - 60_000) {
                actions.trigger_snackbar(t("components.lexical_text_editor_dialog.proposal_start_date_cannot_be_in_the"));
                return;
            }
            if (!isFinite(daily) || daily <= 0) {
                actions.trigger_snackbar(t("components.lexical_text_editor_dialog.daily_pay_must_be_greater_than_zero"));
                return;
            }
        }

        this.setState({ isPublishing: true });

        let permlink;
        try {
            const content = this.getEditorMarkdown();

            // Generate permlink
            const timestamp = Date.now();
            const sanitized = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 24);
            permlink = `${sanitized}-${timestamp}`;

            // First tag is the community (category / parentPermlink)
            const parentPermlink = community;

            // Build JSON metadata — no license
            const jsonMetadata = {
                app: 'pixagram/3.0.2',
                format: 'markdown',
                tags: [community],
                description: description || '',
            };

            // If we have an SVG from the gradient editor, store it as image.
            if (svgContent) {
                const encoded = btoa(unescape(encodeURIComponent(svgContent)));
                jsonMetadata.image = `data:image/svg+xml;base64,${encoded}`;
            } else {
                // Draft round-trip: a reloaded draft carries the gradient's
                // data URI but not the decoded SVG — reuse it directly (same
                // bytes). Raster covers never go on-chain.
                const cover = this._getGradient();
                if (cover && typeof cover === 'string' && cover.startsWith('data:image/svg+xml')) {
                    jsonMetadata.image = cover;
                }
            }

            // Mark the post as a DAO proposal in its metadata so apps rendering
            // the community feed can badge it before the proposal is indexed.
            if (wantsProposal) {
                jsonMetadata.proposal = true;
                if (!jsonMetadata.tags.includes('proposal')) jsonMetadata.tags.push('proposal');
            }

            // Body is the markdown content (not base64)
            await api.broadcast.comment({
                parentAuthor: '',
                parentPermlink: parentPermlink,
                author: activeAccount,
                permlink: permlink,
                title: title,
                body: content,
                jsonMetadata: jsonMetadata
            });
        } catch (error) {
            console.error('Error publishing post:', error);
            this.setState({ isPublishing: false });
            actions.trigger_snackbar(error.message || t("components.lexical_text_editor_dialog.failed_to_publish_post"));
            return; // preview stays open so the user can retry
        }

        // ── Post is on-chain — close the preview and discard the draft so
        //    it doesn't linger. We do this before the optional
        //    create_proposal step because even if that op fails, the post
        //    content is already published and the draft served its purpose.
        //    Also kill the auto-save timer so a pending auto-save doesn't
        //    re-create the draft in the ~1.5s before the dialog closes.
        this.closePreview();
        if (this.autoSaveTimer) { clearTimeout(this.autoSaveTimer); this.autoSaveTimer = null; }
        this._published = true;
        if (this.state.currentDraftId) {
            try {
                await this.draftManager.delete(this.state.currentDraftId);
                this.setState({ currentDraftId: null });
            } catch (e) {
                // Non-fatal: the post made it on-chain, so a stale draft is
                // just cosmetic. Log and move on.
                console.warn('[Editor] Failed to delete draft after publish:', e?.message);
            }
        }

        // ── Post broadcast succeeded. If this is a proposal, fire the
        //    create_proposal op now — we need the post's permlink to
        //    reference from the proposal, which is why we sequence it this
        //    way rather than bundling into one signed transaction.
        if (wantsProposal) {
            try {
                const dailyAmount = Number(proposalDailyPay).toFixed(3);
                await api.broadcast.createProposal({
                    creator: activeAccount,
                    receiver: activeAccount,
                    startDate: _toChainDate(proposalStartDate),
                    endDate: _toChainDate(proposalEndDate),
                    dailyPay: `${dailyAmount} PXS`,
                    // Hive's proposal `subject` is the short summary shown in
                    // listings, so we use the post's short description (which
                    // is exactly that). Title is only a fallback when the
                    // user hasn't filled a description.
                    subject: (description || title || '').slice(0, 80),
                    permlink: permlink,
                    extensions: []
                });
                this.setState({ isPublishing: false });
                actions.trigger_snackbar(t("components.lexical_text_editor_dialog.proposal_submitted_successfully"));
            } catch (error) {
                console.error('Error submitting proposal:', error);
                this.setState({ isPublishing: false });
                // The post is already on-chain — surface a distinct message so
                // the user knows the content survived the proposal failure.
                actions.trigger_snackbar(
                    (error && error.message)
                        ? `Post published, but proposal failed: ${error.message}`
                        : t("components.lexical_text_editor_dialog.post_published_but_the_proposal_submission_faile")
                );
                return;
            }
        } else {
            this.setState({ isPublishing: false });
            actions.trigger_snackbar(t("components.lexical_text_editor_dialog.post_published_successfully"));
        }

        setTimeout(() => {
            if (this.props.onClose) this.props.onClose();
        }, 1500);
    };

    renderMarkdown = (markdown) => {
        try {
            return micromark(markdown, {
                extensions: [gfm()],
                htmlExtensions: [gfmHtml()]
            });
        } catch (error) {
            console.error('Error rendering markdown:', error);
            return '<p>Error rendering content</p>';
        }
    };

    // ── Hover-menu lifecycle ────────────────────────────────────────────
    // The sidebar menus open on hover (EditorToolbar) and stay open while
    // the pointer is over the trigger or the menu paper (FormatMenus).
    // Leaving either schedules a close after a short grace period; entering
    // the other cancels it — that's what lets the pointer cross the gap
    // between button and menu without the menu vanishing.
    _menuClosers = {
        format: () => this.closeFormatMenu(),
        heading: () => this.closeHeadingMenu(),
        list: () => this.closeListMenu(),
    };

    holdMenu = (key) => {
        const timer = this._menuCloseTimers[key];
        if (timer) {
            clearTimeout(timer);
            this._menuCloseTimers[key] = null;
        }
    };

    releaseMenu = (key) => {
        this.holdMenu(key);
        this._menuCloseTimers[key] = setTimeout(() => {
            this._menuCloseTimers[key] = null;
            const close = this._menuClosers[key];
            if (close) close();
        }, 260);
    };

    _captureToolbarSelection = () => {
        const captured = this._captureSelection();
        if (captured) this._savedToolbarSelection = captured;
    };

    openFormatMenu = (e) => { this.holdMenu('format'); this._captureToolbarSelection(); this.setState({ formatMenuAnchor: e.currentTarget }); };
    closeFormatMenu = () => { this.holdMenu('format'); this.setState({ formatMenuAnchor: null }); };
    openHeadingMenu = (e) => { this.holdMenu('heading'); this._captureToolbarSelection(); this.setState({ headingMenuAnchor: e.currentTarget }); };
    openGradientEditor = (e) => {e.stopImmediatePropagation(); e.preventDefault(); this.setState({ gradientEditorOpen: true }); };
    closeHeadingMenu = () => { this.holdMenu('heading'); this.setState({ headingMenuAnchor: null }); };
    openListMenu = (e) => { this.holdMenu('list'); this._captureToolbarSelection(); this.setState({ listMenuAnchor: e.currentTarget }); };
    closeListMenu = () => { this.holdMenu('list'); this.setState({ listMenuAnchor: null }); };
    toggleEditMenu = () => this.setState({ editOpened: !this.state.editOpened });
    resetEditMenu = () => this.setState({ editOpened: false });
    closeGradientEditor = (b64) => {
        this.setState({ gradientEditorOpen: false });
        // Wired as BOTH onAccept and onClose of GradientEditorDialog: a
        // cancel / backdrop close can invoke this with an event object (or
        // nothing). Only an accepted data: URI, or null (explicit clear),
        // may ever reach the gradient.
        if (b64 === null || (typeof b64 === 'string' && b64.startsWith('data:'))) {
            // Keep the raw SVG for jsonMetadata at publish time — covers
            // travel on-chain as < 1 kB SVGs, never as raster data.
            let svgContent = null;
            if (b64 && b64.startsWith('data:image/svg+xml;base64,')) {
                try {
                    svgContent = decodeURIComponent(escape(atob(b64.split(',')[1])));
                } catch (e) {
                    console.warn('Failed to decode SVG:', e);
                }
            }
            this.setState({ svgContent });
            this._setGradient(b64);
        }
    };

    // Stable handlers — previously inline lambdas in render(), which created
    // new function identities every render and defeated every React.memo below.
    onTitleChange = (e) => this.setState({ title: e.target.value });
    onDescriptionChange = (e) => this.setState({ description: e.target.value });
    onPayoutChange = (e) => this.setState({ payout: e.target.value });
    onCommunityChange = (e) => {
        // Switching away from the proposals community silently turns off the
        // proposal flag so a draft never carries a stray proposal config.
        const community = e.target.value;
        this.setState({
            community,
            isProposal: community === PROPOSAL_COMMUNITY_ID ? this.state.isProposal : false,
        });
    };
    onIsProposalChange = (v) => this.setState({ isProposal: v });
    onProposalStartDateChange = (d) => this.setState({ proposalStartDate: d });
    onProposalEndDateChange = (d) => this.setState({ proposalEndDate: d });
    onProposalDailyPayChange = (v) => this.setState({ proposalDailyPay: v });
    onLinkUrlChange = (e) => this.setState({ linkUrl: e.target.value });
    onPasswordValueChange = (e) => this.setState({ passwordDialogValue: e.target.value });
    onImageUrlValueChange = (e) => this.setState({ imageUrlDialogValue: e.target.value });
    onFinish = () => this.setState({ tab: 1 }, this.resetEditMenu);
    onSwipeIndexChange = (v) => this._handleTabChange({}, v);
    onUndo = () => {
        const editor = this.editorRef.current;
        if (editor) editor.dispatchCommand(UNDO_COMMAND, undefined);
    };
    onRedo = () => {
        const editor = this.editorRef.current;
        if (editor) editor.dispatchCommand(REDO_COMMAND, undefined);
    };

    _handleTabChange = (e, value) => {
        this.setState({tab: value}, () => {
            this.swipeableViewScrollTop();
            if(parseInt(value) === 1){
                this.resetEditMenu();
            }
        })
    }

    swipeableViewScrollTop = () => {
        // Guarded: the swipeable container only exists in the mobile layout,
        // and the old unguarded item(0) chain threw if a tab change ever
        // fired outside it (e.g. a resize across the breakpoint mid-change).
        const view = document.getElementsByClassName("react-swipeable-view-container").item(0);
        const child = view && view.children.item(0);
        if (!child) return;
        child.style.scrollBehavior = "smooth";
        child.scrollTop = 0;
    };

    render() {
        const { classes, open, onClose, api } = this.props;
        const gradient = this._getGradient();
        const editMode = !!this.props.editPost;
        const {
            editorMode, markdownSource, initialMarkdown, title, description, tags,
            payout, community,
            isProposal, editProposal, proposalStartDate, proposalEndDate, proposalDailyPay,
            activeAccount, userCommunities, isPublishing,
            editOpened, formatMenuAnchor, headingMenuAnchor, listMenuAnchor,
            linkDialogOpen, linkUrl, linkSelectedText, hasTextSelection,
            wordCount, readingTime, tab, currentDraftId, mobile,
            draftsDialogOpen, drafts, draftsLoading, draftsSearchQuery,
            confirmDialogOpen, confirmDialogTitle, confirmDialogMessage,
            passwordDialogOpen, passwordDialogTitle, passwordDialogValue,
            imageUrlDialogOpen, imageUrlDialogValue, imageUploading,
            previewDialogOpen, previewContent, gradientEditorOpen,
            deleteConfirmDialogOpen, deleteConfirmDraftTitle,
            activeFormats, activeBlockType
        } = this.state;

        const primary = (
            <EditorSection
                key="editor-section"
                classes={classes}
                editorMode={editorMode}
                title={title}
                description={description}
                initialMarkdown={initialMarkdown}
                markdownSource={markdownSource}
                editorRef={this.editorRef}
                onTitleChange={this.onTitleChange}
                onDescriptionChange={this.onDescriptionChange}
                onChange={this.onChange}
                onMarkdownChange={this.onMarkdownChange}
                onFocus={this.focus}
                onSave={this.handleSave}
                onLink={this.openLinkDialog}
                onImage={this.insertImage}
                onImageFiles={this.handleDroppedImageFiles}
                onToggleBlockType={this.toggleBlockType}
                onToolbarStateChange={this.onToolbarStateChange}
            />
        );

        // SettingsPanel now renders its own desktop ActionButtons from these
        // primitive props. Passing the pre-built `actionButtons` ELEMENT here
        // (as before) re-minted a fresh element identity on every render of
        // this dialog — every keystroke — which broke SettingsPanel's memo
        // permanently: it re-rendered each time even though nothing it shows
        // had changed. With primitives + stable handlers, the memo holds.
        const secondary = (
            <SettingsPanel
                key="settings-panel"
                classes={classes}
                api={api}
                gradient={gradient}
                payout={payout}
                community={community}
                communities={userCommunities}
                communityLocked={editMode}
                activeAccount={activeAccount}
                title={title}
                description={description}
                fileInputRef={this.fileInputRef}
                onImageUpload={this.handleImageUpload}
                onRemoveImage={this.removeCoverImage}
                onOpenGradientEditor={this.openGradientEditor}
                onPayoutChange={this.onPayoutChange}
                onCommunityChange={this.onCommunityChange}
                isProposalCommunity={community === PROPOSAL_COMMUNITY_ID && !editMode}
                isProposal={isProposal}
                isProposalEdit={editMode && !!editProposal}
                proposalOriginalDailyPay={editProposal ? _parseDailyPayAmount(editProposal.daily_pay) : ''}
                proposalStartDate={proposalStartDate}
                proposalEndDate={proposalEndDate}
                proposalDailyPay={proposalDailyPay}
                onIsProposalChange={this.onIsProposalChange}
                onProposalStartDateChange={this.onProposalStartDateChange}
                onProposalEndDateChange={this.onProposalEndDateChange}
                onProposalDailyPayChange={this.onProposalDailyPayChange}
                editMode={editMode}
                mobile={mobile}
                tab={tab}
                onOpenDrafts={this.openDraftsDialog}
                onFinish={this.onFinish}
                onPreview={this.openPreview}
            />
        );

        const main = mobile ? (
            <React.Fragment>
                <SwipeableViews
                    axis="y"
                    ignoreNativeScroll={false}
                    containerStyle={SWIPE_CONTAINER_STYLE}
                    animateHeight={false}
                    animateTransitions={true}
                    disableLazyLoading={true}
                    resistance={true}
                    springConfig={SWIPE_SPRING_CONFIG}
                    index={tab}
                    onChangeIndex={this.onSwipeIndexChange}
                    disabled={false}
                    key={"swipe-able-view"}
                >
                    {primary}
                    {secondary}
                </SwipeableViews>
                <ActionButtons
                    mobile={true}
                    tab={tab}
                    editMode={editMode}
                    onOpenDrafts={this.openDraftsDialog}
                    onFinish={this.onFinish}
                    onPreview={this.openPreview}
                />
            </React.Fragment>
        ): (
            [primary, secondary]
        );

        return (
            <React.Fragment>
                <Dialog
                    className={classes.dialog}
                    open={open}
                    maxWidth={false}
                    onClose={onClose}
                    PaperProps={KEY_LEAK_PAPER_PROPS}
                >
                    <AppBar position="sticky" className={classes.appBar}>
                        <Toolbar>
                            <Box flexGrow={1} ml={2}>
                                <Typography variant="h6" style={APPBAR_TITLE_STYLE}>
                                    {editMode ? t("components.lexical_text_editor_dialog.edit_blog_post") : t("components.lexical_text_editor_dialog.write_a_new_blog_post")}
                                </Typography>
                                <Typography variant="caption" style={APPBAR_CAPTION_STYLE}>
                                    {wordCount} words · {readingTime} min read
                                    {currentDraftId && ' · Draft saved'}
                                </Typography>
                            </Box>
                            <IconButton color="inherit" onClick={onClose}>
                                <CloseIcon />
                            </IconButton>
                        </Toolbar>
                    </AppBar>

                    <DialogContent className={classes.contentArea}>
                        <div className={classes.mainContainer}>
                            {main}
                        </div>
                    </DialogContent>

                    <EditorToolbar
                        classes={classes}
                        editorMode={editorMode}
                        tab={tab}
                        mobile={mobile}
                        editOpened={editOpened}
                        activeFormats={activeFormats}
                        activeBlockType={activeBlockType}
                        hasSelection={hasTextSelection}
                        onToggleEditMenu={this.toggleEditMenu}
                        onToggleInlineStyle={this.toggleInlineStyle}
                        onToggleBlockType={this.toggleBlockType}
                        onToggleEditorMode={this.toggleEditorMode}
                        onOpenFormatMenu={this.openFormatMenu}
                        onOpenListMenu={this.openListMenu}
                        onOpenHeadingMenu={this.openHeadingMenu}
                        onMenuRelease={this.releaseMenu}
                        onOpenLinkDialog={this.openLinkDialog}
                        onInsertImage={this.insertImage}
                        onUndo={this.onUndo}
                        onRedo={this.onRedo}
                    />
                </Dialog>

                <PreviewDialog
                    classes={classes}
                    open={previewDialogOpen}
                    title={title}
                    description={description}
                    content={previewContent}
                    wordCount={wordCount}
                    readingTime={readingTime}
                    activeAccount={activeAccount}
                    isPublishing={isPublishing}
                    editMode={editMode}
                    onClose={this.closePreview}
                    onPublish={this.handlePublish}
                    renderMarkdown={this.renderMarkdown}
                />

                <DraftsDialog
                    classes={classes}
                    open={draftsDialogOpen}
                    drafts={drafts}
                    loading={draftsLoading}
                    searchQuery={draftsSearchQuery}
                    onClose={this.closeDraftsDialog}
                    onNewDraft={this.createNewDraft}
                    onLoadDraft={this.loadDraft}
                    onDeleteDraft={this.showDeleteConfirmDialog}
                    onSearchChange={this.handleDraftsSearch}
                    formatDate={this.formatDate}
                />

                <ConfirmDialog
                    classes={classes}
                    open={confirmDialogOpen}
                    title={confirmDialogTitle}
                    message={confirmDialogMessage}
                    onClose={this.closeConfirmDialog}
                    onConfirm={this.handleConfirmAction}
                />

                {/* Delete Confirmation Dialog */}
                <ConfirmDialog
                    classes={classes}
                    open={deleteConfirmDialogOpen}
                    title={t("components.lexical_text_editor_dialog.delete_draft")}
                    message={`Are you sure you want to delete "${deleteConfirmDraftTitle}"? This action cannot be undone.`}
                    onClose={this.closeDeleteConfirmDialog}
                    onConfirm={this.handleDeleteConfirm}
                />

                <PasswordDialog
                    classes={classes}
                    open={passwordDialogOpen}
                    title={passwordDialogTitle}
                    value={passwordDialogValue}
                    onClose={this.closePasswordDialog}
                    onConfirm={this.handlePasswordAction}
                    onChange={this.onPasswordValueChange}
                />

                <ImageUrlDialog
                    classes={classes}
                    open={imageUrlDialogOpen}
                    value={imageUrlDialogValue}
                    uploading={imageUploading}
                    onClose={this.closeImageUrlDialog}
                    onInsert={this.handleImageUrlInsert}
                    onChange={this.onImageUrlValueChange}
                    onFileSelected={this.handleImageFileSelected}
                />

                <FormatMenus
                    classes={classes}
                    formatMenuAnchor={formatMenuAnchor}
                    headingMenuAnchor={headingMenuAnchor}
                    listMenuAnchor={listMenuAnchor}
                    onCloseFormatMenu={this.closeFormatMenu}
                    onCloseHeadingMenu={this.closeHeadingMenu}
                    onCloseListMenu={this.closeListMenu}
                    onMenuHold={this.holdMenu}
                    onMenuRelease={this.releaseMenu}
                    onToggleInlineStyle={this.toggleInlineStyle}
                    onToggleBlockType={this.toggleBlockType}
                />

                <LinkDialog
                    classes={classes}
                    open={linkDialogOpen}
                    selectedText={linkSelectedText}
                    linkUrl={linkUrl}
                    onClose={this.closeLinkDialog}
                    onInsert={this.insertLink}
                    onUrlChange={this.onLinkUrlChange}
                />

                <GradientEditorDialog
                    open={gradientEditorOpen}
                    onAccept={this.closeGradientEditor}
                    onClose={this.closeGradientEditor}
                />
            </React.Fragment>
        );
    }
}

export default withStyles(styles)(LexicalTextEditorDialog);