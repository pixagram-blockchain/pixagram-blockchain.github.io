import * as React from "preact/compat";
import { useReducer, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Card from '@material-ui/core/Card';
import Backdrop from '@material-ui/core/Backdrop';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemText from '@material-ui/core/ListItemText';

import Portal from '@material-ui/core/Portal';
import Tooltip from '@material-ui/core/Tooltip';
import Avatar from "@material-ui/core/Avatar";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import CloseIcon from "@material-ui/icons/Close";
import CardHeader from "@material-ui/core/CardHeader";
import useLiveTimeAgo from "../hooks/useLiveTimeAgo";
import ChevronRightCircleOutlined from "../icons/ChevronRightCircleOutlined";
import PixaSupra from "../icons/PixaSupra";
import AutoSizer from '@pixagram/virtualized/dist/es/AutoSizer';
import VirtualizedList from '@pixagram/virtualized/dist/es/List';
import {crtF, hexF, sqrF, triF, xbrzF, acquireBestCachedBitmap} from "../utils/render-pool";

import ArrowForwardIosIcon from "@material-ui/icons/ArrowForwardIos";
import InfoOutlined from "@material-ui/icons/InfoOutlined";
import JSLoader from "../utils/JSLoader";
import {HISTORY, POST_DRAWER_TAB_HASHES, parsePostDrawerHash, parseCommentFocusHash, buildCommentFocusHash, getPostState, POST_STATE} from "../utils/constants";
import Chip from "@material-ui/core/Chip";
import Palette from '@material-ui/icons/Palette'
import SwapVert from '@material-ui/icons/SwapVert'
import SwapHoriz from '@material-ui/icons/SwapHoriz'
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListSubheader from "@material-ui/core/ListSubheader";
import Grid from "@material-ui/core/Grid";
import Info from "@material-ui/icons/Info";
import License from "../icons/License";
import LicenseDialog from "./LicenseDialog";
import {PIXA_LICENSE_BASE as baseLicenseData} from "../utils/pixa_license";
import { sanitizeComment as rawSanitizeComment, safeHTML } from "../utils/api/sanitizer";
import CloudDownload from "@material-ui/icons/CloudDownload";
import CommentRounded from "@material-ui/icons/CommentRounded";
import DescriptionRounded from "@material-ui/icons/DescriptionRounded";
import LabelRounded from "@material-ui/icons/LabelRounded";
import SendRounded from "@material-ui/icons/SendRounded";
import VisibilityRounded from "@material-ui/icons/VisibilityRounded";
import VisibilityOffRounded from "@material-ui/icons/VisibilityOffRounded";
import CircularProgress from "@material-ui/core/CircularProgress";
import CommentInList from "./CommentInList";
import { ToxicityWatcher } from "./ToxicityHint";
import * as toxicity from "../utils/toxicity";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Collapse from "@material-ui/core/Collapse";
import SwipeableViews from "react-swipeable-views";
import TextField from "@material-ui/core/TextField";
import Fade from "@material-ui/core/Fade";
import Radio from "@material-ui/core/Radio";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import RadioGroup from "@material-ui/core/RadioGroup";
import FormControl from "@material-ui/core/FormControl";
import FormLabel from "@material-ui/core/FormLabel";
import FilledInput from "@material-ui/core/FilledInput/FilledInput";
import InputLabel from "@material-ui/core/InputLabel";
import InputAdornment from "@material-ui/core/InputAdornment";
import * as clipboard from "clipboard-polyfill";
import * as actions from "../actions/utils";
import ClipboardText from "../icons/ClipboardText";
import ClipboardCheck from "../icons/ClipboardCheck";
import MoreVertRounded from "@material-ui/icons/MoreVertRounded";
import HourglassEmptyRounded from "@material-ui/icons/HourglassEmptyRounded";
import EditRounded from "@material-ui/icons/EditRounded";
import DeleteOutlineRounded from "@material-ui/icons/DeleteOutlineRounded";
import EditPostDialog from "./EditPostDialog";
import DeleteCommentModal from "./DeleteCommentModal";
import ChevronRightRounded from "@material-ui/icons/ChevronRightRounded";
import FolderSpecialRounded from "@material-ui/icons/FolderSpecialRounded";
import PrintRounded from "@material-ui/icons/PrintRounded";
import SecurityRounded from "@material-ui/icons/SecurityRounded";
import ShareRounded from "@material-ui/icons/ShareRounded";
import PaperCardActions from "./PaperCardActions";
import FavoriteRounded from "@material-ui/icons/FavoriteRounded";
import FavoriteBorderRounded from "@material-ui/icons/FavoriteBorderRounded";
import * as favorites from "../utils/favorites";
import { analyze_colors } from 'smart-downscaler';

import { pngdby } from "../utils/png-db";

import { T } from "../utils/T";
import { t, useLanguage } from "../utils/text";

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


async function getMetadata(source){
    if(!source) return null;

    // Fast path: the feed card already decoded the PNG and handed us its
    // ImageData + dims via `size`. Skip the base64 → ImageData decode and
    // only fill in whatever's missing (colors is the only derived field
    // the card doesn't carry).
    if (typeof source === "object" && source.imgd) {
        const imgd   = source.imgd;
        const width  = source.width  || imgd.width;
        const height = source.height || imgd.height;
        // Palette is drawer chrome, not flight-critical: when the source
        // didn't precompute it, return null and let the open effect fill
        // it in off the critical path (see the deferred analyze_colors
        // pass there) — the WASM palette scan over the full source must
        // never sit between the click and the hero's first frame.
        return { imgd, colors: source.colors || null, width, height };
    }

    // Slow path: decode from the base64 string source.
    const imgOBJ = await pngdby.get_new_img_obj(source);
    const imgd   = await pngdby.get_new_img_data(imgOBJ);
    if (!imgd) return null; // undecodable — caller treats it as a failed open
    return { imgd, colors: null, width: imgd.width, height: imgd.height };
}

function createCanvas(width, height) {
    let canvas;
    if("OffscreenCanvas" in window) {
        canvas = new OffscreenCanvas(width, height);
    }else {
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
    }

    canvas.ctx = canvas.getContext("2d");

    return canvas;
}

// Shared mapper: resolve author profiles for a batch of raw chain replies, then
// map them into the flat comment shape the dialog renders. Used both when
// loading a thread level (fetchRepliesFor) and when CommentInList lazily loads a
// comment's inline replies (loadRepliesFor), so the two paths stay identical.
function buildReplyComments(rawReplies, accounts, localAuthors) {
    const profileMap = {};
    if (Array.isArray(accounts)) {
        for (const acc of accounts) {
            const u = acc.name || acc.account || ""; if (!u) continue;
            let img = "", name = u;
            try { const m = typeof acc.posting_json_metadata === "string" ? JSON.parse(acc.posting_json_metadata) : (acc.posting_json_metadata || {}); const p = m.profile || {}; img = p.profile_image || p.image || ""; name = p.name || u; }
            catch(e) { try { const m2 = typeof acc.json_metadata === "string" ? JSON.parse(acc.json_metadata) : (acc.json_metadata || {}); const p2 = m2.profile || {}; img = p2.profile_image || p2.image || ""; name = p2.name || u; } catch(e2) {} }
            profileMap[u] = { username: u, name, image: img };
        }
    }
    const locals = localAuthors || {};
    return (rawReplies || []).map((r) => {
        const u = r.author || "";
        let body = r.body || "";
        try { body = rawSanitizeComment(body).html || body; } catch(e) {}
        return {
            username: u, body, date: r.created || Date.now(),
            upVotesNumber: (r.active_votes || []).filter(v => v.weight >= 0).length,
            downVotesNumber: (r.active_votes || []).filter(v => v.weight < 0).length,
            permlink: r.permlink || "", children: r.children || 0,
            active_votes: r.active_votes || [],
            author: profileMap[u] || locals[u] || { username: u, name: u, image: "" }
        };
    });
}

// NFT Information View - Enhanced
const isUnique = false;
const edition = 5;
const maxEditions = isUnique ? 1 : edition;
const currentPrice = 250.00;
const currency = "PXS";
const transferFee = 5;
const isAuction = false;
const auctionEndDate = Date.now() + (7 * 24 * 60 * 60 * 1000);
const currentBid = 180.00;
const bidders = 3;
const buyNowPrice = 500.00;

const editionsData = [
    { edition: 1, owner: "azal", forSale: false, price: null, soldPrice: 320, soldDate: Date.now() - (30 * 24 * 60 * 60 * 1000) },
    { edition: 2, owner: "sophiajulio", forSale: true, price: 280, soldPrice: null, soldDate: null },
    { edition: 3, owner: "technoania", forSale: true, price: 250, soldPrice: null, soldDate: null },
    { edition: 4, owner: "primerz", forSale: false, price: null, soldPrice: 180, soldDate: Date.now() - (15 * 24 * 60 * 60 * 1000) },
    { edition: 5, owner: "chuckchuck", forSale: true, price: 300, soldPrice: null, soldDate: null },
];

const availableEditions = editionsData.filter(e => e.forSale);
const soldEditions = editionsData.filter(e => e.soldPrice !== null);
const floorPrice = availableEditions.length > 0 ? Math.min(...availableEditions.map(e => e.price)) : null;
const totalVolume = soldEditions.reduce((sum, e) => sum + (e.soldPrice || 0), 0);
const avgSalePrice = soldEditions.length > 0 ? totalVolume / soldEditions.length : 0;
const lastSalePrice = soldEditions.length > 0 ? soldEditions.sort((a, b) => (b.soldDate || 0) - (a.soldDate || 0))[0].soldPrice : null;

const getRarity = (max) => {
    if (max === 1) return { label: "Unique", color: "#FFD700" };
    if (max <= 10) return { label: "Rare", color: "#C0C0C0" };
    if (max <= 100) return { label: "Common", color: "#CD7F32" };
    return { label: "Standard", color: "#888888" };
};

const rarity = getRarity(maxEditions);

const ownershipHistory = [
    { owner: "sophiajulio", price: 180.00, date: Date.now() - (30 * 24 * 60 * 60 * 1000), type: "transfer", edition: 2 },
    { owner: "azal", price: 120.00, date: Date.now() - (60 * 24 * 60 * 60 * 1000), type: "purchase", edition: 1 },
];

const collections = [
    { name: "Summer Vibes 2025", id: 1, count: 24, floorPrice: 180 },
    { name: "Pixel Masters", id: 2, count: 156, floorPrice: 95 }
];

// Memoized Components for optimization
const ColorBadge = React.memo(({ color, classes }) => (
    <Tooltip key={color.hex} arrow interactive title={color.hex + " (" + color.percentage.toFixed(2) + "%)"}>
        <div className={classes.colorBadge} style={{ backgroundColor: color.hex }}></div>
    </Tooltip>
), (a, b) => a.color.hex === b.color.hex);

const TagChip = React.memo(({ tag, index, onTagClick }) => (
    <Chip
        key={"#".concat(tag.concat(index.toString(10)))}
        label={"#".concat(tag.toLowerCase())}
        onClick={() => onTagClick(tag.toLowerCase())}
    />
), (a, b) => a.tag === b.tag);

// Live relative date bridge — renders useLiveTimeAgo's label as its own
// tiny component so each tick (every second while the post is under a
// minute old, every minute under an hour, then hourly/daily — same
// cadence as PaperCard) re-renders ONLY this text node, never the
// memo'd host around it. The hook releases its watcher on unmount.
const LIVE_TIME_AGO_OPTIONS = {};
const LiveTimeAgo = React.memo(function LiveTimeAgo({ date, options = LIVE_TIME_AGO_OPTIONS }) {
    return useLiveTimeAgo(date, options);
});

const ParentComment = React.memo(({ comment, index, classes, locales, onOpenAuthor, api }) => (
        <div key={"comment" + index} style={{
            position: "relative",
            padding: "12px 12px 12px 12px",
            margin: "32px 4px 0px 4px",
            borderRadius: "12px",
            backgroundColor: "#121212"
        }}>
            {index > 0 && <ArrowForwardIosIcon key={"arrow-" + index} style={{
                color: "#575757",
                transform: "translate(-50%, -50%) rotate(90deg)",
                left: "50%",
                top: "-16px",
                position: "absolute"
            }} />}
            <Typography
                component="span"
                variant="body2"
                color="textPrimary"
                style={{ marginBottom: 4, display: "block" }}
            >
                <Tooltip title={"@" + (comment.author || {}).username}>
                <span className={classes.subheaderName} onClick={(event) => { onOpenAuthor((comment.author || {}).username) }}>
                    {(comment.author || {}).name}
                </span>
                </Tooltip>
                <span style={{ color: "#999" }}> said </span>
                <Tooltip arrow title={new Date(comment.date || Date.now()).toLocaleDateString(locales, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric'
                })}>
                    <span><LiveTimeAgo date={comment.date || Date.now()} /></span>
                </Tooltip>
            </Typography>
            <Typography
                component="div"
                variant="body1"
                color="textSecondary"
                style={{ lineHeight: "1rem", letterSpacing: 0 }}
                dangerouslySetInnerHTML={{ __html: safeHTML(renderCommentBody(api, comment.body)) }}
            />
        </div>
    ), (a, b) =>
        a.index === b.index
        && a.locales === b.locales
        && a.classes === b.classes
        && a.onOpenAuthor === b.onOpenAuthor
        && a.comment === b.comment // identity is enough; new comment object ⇒ new render
);

const EditionRow = React.memo(({ edition }) => (
    <div key={edition.edition} style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid #333"
    }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Typography variant="body2" style={{
                color: "#fff",
                fontWeight: "bold",
                minWidth: 60
            }}>
                #{edition.edition}
            </Typography>
            <Typography variant="body2" style={{ color: "#888" }}>
                @{edition.owner}
            </Typography>
        </div>
        <div style={{ textAlign: "right" }}>
            {edition.forSale ? (
                <div>
                    <Typography variant="body2" style={{
                        color: "#ffffff",
                        fontWeight: "bold"
                    }}>
                        {edition.price} {currency}
                    </Typography>
                    <Typography variant="caption" style={{ color: "#666" }}>
                        {t("components.post_dialog.for_sale")}
                    </Typography>
                </div>
            ) : edition.soldPrice ? (
                <div>
                    <Typography variant="body2" style={{ color: "#888" }}>{t("components.post_dialog.last", {
                        soldPrice: edition.soldPrice,
                        currency: currency
                    })}</Typography>
                    <Typography variant="caption" style={{ color: "#666" }}>
                        <LiveTimeAgo date={edition.soldDate} />
                    </Typography>
                </div>
            ) : (
                <Typography variant="body2" style={{ color: "#666" }}>
                    {t("components.post_dialog.not_for_sale")}
                </Typography>
            )}
        </div>
    </div>
), (a, b) => {
    const x = a.edition, y = b.edition;
    return x === y || (
        x && y
        && x.edition === y.edition
        && x.owner === y.owner
        && x.forSale === y.forSale
        && x.price === y.price
        && x.soldPrice === y.soldPrice
        && x.soldDate === y.soldDate
    );
});

const OwnershipEvent = React.memo(({ event, index }) => (
    <div key={index} style={{
        position: "relative",
        marginBottom: 24,
        paddingLeft: 24
    }}>
        <div style={{
            position: "absolute",
            left: -8,
            top: 8,
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: index === 0 ? "#dadada" : "#666",
            border: "2px solid #1a1a1a"
        }} />
        <div style={{
            backgroundColor: "#0f0f0f",
            borderRadius: 8,
            padding: 12
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <Typography variant="body2" style={{ color: "#fff" }}>
                    @{event.owner}
                </Typography>
                <Typography variant="caption" style={{ color: "#666" }}>
                    <LiveTimeAgo date={event.date || Date.now()} />
                </Typography>
            </div>
            <Typography variant="caption" style={{ color: "#888" }}>
                {event.type === "minted" ? "Minted editions" :
                    event.type === "transfer" ? t("components.post_dialog.transferred_edition", {
                            edition: event.edition
                        }) :
                        t("components.post_dialog.purchased_edition", {
                            edition: event.edition
                        })}
                {event.price > 0 && ` for ${event.price} ${currency}`}
            </Typography>
        </div>
    </div>
), (a, b) => {
    if (a.index !== b.index) return false;
    const x = a.event, y = b.event;
    return x === y || (
        x && y
        && x.owner === y.owner
        && x.date === y.date
        && x.type === y.type
        && x.edition === y.edition
        && x.price === y.price
    );
});

const CollectionItem = React.memo(({ collection }) => (
    <ListItem key={collection.id} button style={{ borderRadius: 8 }}>
        <ListItemIcon>
            <FolderSpecialRounded style={{ color: "#666" }} />
        </ListItemIcon>
        <ListItemText
            primary={collection.name}
            secondary={t("components.post_dialog.items_floor", {
                count: collection.count,
                floorPrice: collection.floorPrice,
                currency: currency
            })}
        />
        <ChevronRightRounded style={{ color: "#444" }} />
    </ListItem>
), (a, b) => {
    // Previous comparator read `a.id` / `b.id` — but the prop is `collection`,
    // so it compared `undefined === undefined` and *always* skipped re-render.
    // That meant a parent updating a collection in-place (same array slot,
    // mutated name/count/floor) would render stale text forever. Fixed:
    // compare the actual collection identity, then the displayed fields.
    const x = a.collection, y = b.collection;
    return x === y || (
        x && y
        && x.id === y.id
        && x.name === y.name
        && x.count === y.count
        && x.floorPrice === y.floorPrice
    );
});

// Memoized View Components
const DetailsView = React.memo(({
                                    id,
                                    data,
                                    metadata,
                                    classes,
                                    type,
                                    kb,
                                    tags,
                                    onTagClick,
                                    onDownloadArtwork,
                                    onOpenLicenseDialog,
                                    copied,
                                    onCopy,
                                    isOwner,
                                    onEditPost,
                                    isFavorite,
                                    onToggleFavorite
                                }) => (
    <React.Fragment>
        {/* Description — sanitized by the pipeline, safe for innerHTML */}
        {data._description_html ? (
            <Typography variant="body1" color="textSecondary" component="div" style={{
                margin: 0,
                color: "rgba(255, 255, 255, 0.5)",
                userSelect: "text",
                lineHeight: "1.125",
                fontSize: "1rem",
                letterSpacing: 0,
                textAlign: "justify"
            }} dangerouslySetInnerHTML={{ __html: safeHTML(data._description_html) }} />
        ) : data._summary ? (
            <Typography variant="body1" color="textSecondary" component="p" style={{
                margin: 0,
                color: "rgba(255, 255, 255, 0.5)",
                userSelect: "text",
                lineHeight: "1.125",
                fontSize: "1rem",
                letterSpacing: 0,
                textAlign: "justify"
            }}>
                {data._summary}
            </Typography>
        ) : null}
        <div className={classes.chipTags}>
            {tags.map((text, index) => (
                <TagChip key={index} tag={text} index={index} onTagClick={onTagClick} />
            ))}
        </div>
        <List className={classes.list}>
            <ListSubheader disableSticky>{t("components.post_dialog.image")}</ListSubheader>
            <ListItem>
                <ListItemIcon><SwapHoriz /></ListItemIcon>
                <ListItemText>{t("components.post_dialog.px_width", {
                    width: metadata.width
                })}</ListItemText>
            </ListItem>
            <ListItem>
                <ListItemIcon><SwapVert /></ListItemIcon>
                <ListItemText>{t("components.post_dialog.px_height", {
                    height: metadata.height
                })}</ListItemText>
            </ListItem>
            <ListItem>
                <ListItemIcon><Palette /></ListItemIcon>
                <ListItemText>{t("components.post_dialog.colors", {
                    color_count: (metadata.colors || []).length
                })}</ListItemText>
            </ListItem>
            <div className={classes.colorBadges}>
                {(metadata.colors || []).map((o) => (
                    <ColorBadge key={o.hex} color={o} classes={classes} />
                ))}
            </div>
            <ListSubheader disableSticky>{t("components.post_dialog.artwork")}</ListSubheader>
            <Tooltip title={t("components.post_dialog.download_the_original_image")}>
                <ListItem onClick={onDownloadArtwork} style={{ cursor: "pointer" }}>
                    <ListItemIcon><Info /></ListItemIcon>
                    <ListItemText>{type.toUpperCase()} of {kb.toFixed(2)} kB</ListItemText>
                </ListItem>
            </Tooltip>
            <Tooltip title={t("components.post_dialog.view_the_artworks_license")}>
                <ListItem onClick={onOpenLicenseDialog} style={{ cursor: "pointer" }}>
                    <ListItemIcon><License /></ListItemIcon>
                    <ListItemText>{t("components.post_dialog.pixa_license_1_0")}</ListItemText>
                </ListItem>
            </Tooltip>
            {isOwner && <ListSubheader disableSticky>{t("components.post_dialog.manage")}</ListSubheader>}
            {isOwner && (
                <Tooltip title={t("components.post_dialog.edit_title_description_tags_nsfw_and_deleted")}>
                    <ListItem onClick={onEditPost} style={{ cursor: "pointer" }}>
                        <ListItemIcon><EditRounded /></ListItemIcon>
                        <ListItemText>{t("words.edit_post_details")}</ListItemText>
                    </ListItem>
                </Tooltip>
            )}
            <ListSubheader disableSticky>{t("components.post_dialog.share")}</ListSubheader>
            <Tooltip title={t("components.post_dialog.copy_the_link_and_past_it_on")}>
                <FormControl className={classes.urlLink} variant="filled" style={{width: "100%"}}>
                    <InputLabel htmlFor="filled-adornment-copy">{t("components.post_dialog.current_url")}</InputLabel>
                    <FilledInput
                        id="filled-adornment-copy"
                        type={'text'}
                        fullWidth
                        value={window.location.href}
                        endAdornment={
                            <InputAdornment position="end">
                                <Tooltip title={t("components.post_dialog.copy_the_link_to_the_clipboard")}>
                                    <IconButton
                                        aria-label={t("components.post_dialog.copy_text_url")}
                                        onClick={() => onCopy(window.location.href)}
                                        edge="end"
                                    >
                                        {copied ? <ClipboardCheck /> : <ClipboardText />}
                                    </IconButton>
                                </Tooltip>
                            </InputAdornment>
                        }
                    />
                </FormControl>
            </Tooltip>
            <ListSubheader disableSticky>{t("components.post_dialog.actions")}</ListSubheader>
            <Tooltip title={isFavorite ? "Remove this artwork from your favorites" : "Save this artwork to your favorites"}>
                <ListItem onClick={onToggleFavorite} style={{ cursor: "pointer" }}>
                    <ListItemText>{isFavorite ? "Remove from favorites" : "Add to favorites"}</ListItemText>
                    {isFavorite
                        ? <FavoriteRounded style={{ color: "#e3e3e3", marginLeft: "auto", flexShrink: 0 }} />
                        : <FavoriteBorderRounded style={{ color: "#8a8a8a", marginLeft: "auto", flexShrink: 0 }} />}
                </ListItem>
            </Tooltip>
        </List>
    </React.Fragment>
), function (a, b){
    if (a.id !== b.id || a.data !== b.data) return false;
    if (a.isOwner !== b.isOwner) return false;
    if (a.isFavorite !== b.isFavorite) return false;
    if (a.metadata !== b.metadata) return false;
    /* Belt-and-suspenders: deep-check metadata fields in case Preact's
     * batching reuses an object reference across two reducer patches. */
    const am = a.metadata, bm = b.metadata;
    if (am && bm && (am.width !== bm.width || am.height !== bm.height
        || (am.colors || []).length !== (bm.colors || []).length)) return false;
    if (a.copied !== b.copied) return false;
    if (a.kb !== b.kb || a.type !== b.type) return false;
    return true;
});

/* OPT #17: Replaced JSON.stringify comparison with shallow reference + length check */
const CommentsView = React.memo(({
                                     id,
                                     currentComments,
                                     showParent,
                                     sorting,
                                     comments,
                                     classes,
                                     locales,
                                     commentsLoading,
                                     api,
                                     account,
                                     focusKey,
                                     focusPathKeys,
                                     onToggleShowParent,
                                     onSliceReplies,
                                     onSortingChange,
                                     onShowReplies,
                                     onLoadReplies,
                                     onOpenAuthor,
                                     onReply,
                                     onEditComment,
                                     onDeleteComment
                                 }) => (
    <div>
        <Collapse in={currentComments.length > 0}>
            <div>
                <div style={{
                    display: "flow",
                    height: "48px",
                    position: "relative",
                    width: "calc(100% - 32px)",
                    margin: "24px 16px 0px 16px"
                }}>
                    <div style={{ float: "left", display: "flex", position: "relative" }}>
                        <IconButton onClick={onToggleShowParent}>
                            {!showParent ? <VisibilityRounded /> : <VisibilityOffRounded />}
                        </IconButton>
                        <FormLabel component="legend" style={{
                            verticalAlign: "middle",
                            lineHeight: "48px",
                            color: "#fff"
                        }}>{t("words.reply_to")}</FormLabel>
                    </div>
                    <div className={classes.repliesGroup}>
                        {currentComments.map((data, i) => {
                            const author = data.author || {};
                            return (
                                <React.Fragment key={i}>
                                    {i > 0 && <ArrowForwardIosIcon key={"arrow-" + i} style={{
                                        color: "#575757",
                                        transform: "rotate(-180deg)",
                                        margin: "8px 0px 8px 0px"
                                    }} />}
                                    <Avatar
                                        key={"avatar-" + i}
                                        alt={author.name}
                                        onClick={() => { onSliceReplies(i) }}
                                        src={author.image}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Collapse>
        <Collapse in={showParent}>
            <div>
                {currentComments.map((comment, i) => (
                    <ParentComment
                        key={currentComments.length - i}
                        comment={comment}
                        index={i}
                        classes={classes}
                        locales={locales}
                        onOpenAuthor={onOpenAuthor}
                        api={api}
                    />
                ))}
            </div>
        </Collapse>
        <FormControl component="fieldset" style={{
            display: "flow",
            position: "relative",
            width: "calc(100% - 32px)",
            margin: "24px 16px 0px 16px"
        }}>
            <FormLabel component="legend" style={{
                color: "#fff",
                margin: "10px 8px 8px 0px",
                float: "left",
                fontWeight: "bold"
            }}>{t("words.sort_by")}</FormLabel>
            <RadioGroup
                value={sorting}
                defaultValue={"Hype"}
                onChange={onSortingChange}
                row
                aria-label="sorting"
                name="sorting"
                style={{ justifyContent: "end", float: "right" }}
            >
                {["Hype", "Votes", "New"].map((label) => (
                    <FormControlLabel
                        style={{ color: "#888" }}
                        labelPlacement="end"
                        key={label}
                        value={label}
                        control={<Radio color="primary" />}
                        label={label}
                    />
                ))}
            </RadioGroup>
        </FormControl>
        <List>
            {commentsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                    <CircularProgress size={32} style={{ color: "#888" }} />
                </div>
            ) : comments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px" }}>
                    <CommentRounded style={{ fontSize: 48, color: "#333", marginBottom: 8 }} />
                    <Typography variant="body1" style={{ color: "#666", marginBottom: 4 }}>
                        {t("words.no_comments_yet")}
                    </Typography>
                    <Typography variant="body2" style={{ color: "#444" }}>
                        {t("words.be_the_first_to_share_your_thoughts")}
                    </Typography>
                </div>
            ) : comments.map((comment, id) => (
                /* permlink key: instances travel with their comment on sort —
                   no cross-comment slot reuse (spurious vote-bounce) and no
                   reply-cache invalidation/refetch on every sort change. */
                (<CommentInList
                    id={id}
                    key={comment.permlink || id}
                    data={comment}
                    api={api}
                    account={account}
                    focusKey={focusKey}
                    focusPathKeys={focusPathKeys}
                    onShowReplies={(comment, ancestors) => onShowReplies(comment, ancestors)}
                    onLoadReplies={onLoadReplies}
                    onReply={(comment, ancestors) => onReply(comment, ancestors)}
                    onEdit={onEditComment}
                    onDelete={onDeleteComment}
                />)
            ))}
        </List>
    </div>
), function (a, b){
    /* OPT #17: Shallow comparison instead of JSON.stringify */
    if (a.id !== b.id || a.sorting !== b.sorting || a.showParent !== b.showParent || a.commentsLoading !== b.commentsLoading) return false;
    if (a.api !== b.api || a.account !== b.account) return false;
    if (a.focusKey !== b.focusKey || a.focusPathKeys !== b.focusPathKeys) return false;
    if (a.comments !== b.comments) return false;
    if (a.currentComments === b.currentComments) return true;
    if (a.currentComments.length !== b.currentComments.length) return false;
    for (let i = 0; i < a.currentComments.length; i++) {
        if (a.currentComments[i] !== b.currentComments[i]) return false;
    }
    return true;
});

const NFTView = React.memo(({ id, data }) => (
    <div style={STYLE_NFT_COMING_SOON_WRAP}>
        {/* Blurred, non-interactive preview of the upcoming NFT marketplace */}
        <div style={STYLE_NFT_BLURRED} aria-hidden="true">
            <div style={{ paddingBottom: 96 }}>
                {/* NFT Header Section */}
                <div style={{
                    background: "#0f0f0f",
                    borderRadius: 16,
                    padding: 21,
                    margin: "8px 0px 16px",
                    position: "relative",
                    overflow: "hidden"
                }}>
                    <div style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: "50%",
                        height: "100%",
                        pointerEvents: "none"
                    }} />

                    <div style={{ position: "relative", zIndex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                            <div>
                                <Typography variant="h6" style={{ color: "#fff", fontWeight: "bold", marginBottom: 8 }}>{t("components.post_dialog.nft", {
                                    String: String(data.id||"08374393").substring(0, 8) || "A1B2C3D4"
                                })}</Typography>
                                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                                    <Chip
                                        label={rarity.label}
                                        style={{
                                            color: rarity.color,
                                            fontWeight: "bold"
                                        }}
                                    />
                                    <Typography variant="body2" style={{ color: "#aaa" }}>
                                        {maxEditions} editions
                                    </Typography>
                                </div>
                                <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
                                    <div>
                                        <Typography variant="caption" style={{ color: "#888", display: "block" }}>
                                            {t("components.post_dialog.floor_price")}
                                        </Typography>
                                        <Typography variant="body2" style={{ color: "#fff", fontWeight: "bold" }}>
                                            {floorPrice ? `${floorPrice} ${currency}` : "No offers"}
                                        </Typography>
                                    </div>
                                    <div>
                                        <Typography variant="caption" style={{ color: "#888", display: "block" }}>
                                            {t("components.post_dialog.last_sale")}
                                        </Typography>
                                        <Typography variant="body2" style={{ color: "#fff", fontWeight: "bold" }}>
                                            {lastSalePrice ? `${lastSalePrice} ${currency}` : "—"}
                                        </Typography>
                                    </div>
                                    <div>
                                        <Typography variant="caption" style={{ color: "#888", display: "block" }}>
                                            {t("components.post_dialog.available")}
                                        </Typography>
                                        <Typography variant="body2" style={{ color: "#fff", fontWeight: "bold" }}>
                                            {availableEditions.length}/{maxEditions}
                                        </Typography>
                                    </div>
                                </div>
                            </div>
                            <IconButton style={{ color: "#666" }}>
                                <MoreVertRounded />
                            </IconButton>
                        </div>
                    </div>
                </div>

                {/* Market Status */}
                {availableEditions.length > 0 ? (
                    <Card style={{ backgroundColor: "#1a1a1a", marginBottom: 20, borderRadius: 12 }}>
                        <CardContent>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <Typography variant="subtitle1" style={{ color: "#fff", fontWeight: "bold" }}>
                                    {t("components.post_dialog.available_editions")}
                                </Typography>
                                <Typography variant="body2" style={{ color: "#ffffff" }}>{t("components.post_dialog.for_sale_2", {
                                    availableEdition_count: availableEditions.length
                                })}</Typography>
                            </div>

                            <div style={{
                                backgroundColor: "#0f0f0f",
                                borderRadius: 8,
                                padding: 16,
                                marginBottom: 16
                            }}>
                                <Typography variant="caption" style={{ color: "#ffffff", fontWeight: "bold" }}>
                                    {t("components.post_dialog.best_price")}
                                </Typography>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                                    <div>
                                        <Typography variant="h5" style={{ color: "#fff", fontWeight: "bold" }}>
                                            {floorPrice} {currency}
                                        </Typography>
                                        <Typography variant="body2" style={{ color: "#666" }}>
                                            ${(floorPrice * 5.69).toFixed(2)} USD
                                        </Typography>
                                    </div>
                                    <Typography variant="body2" style={{ color: "#888" }}>
                                        Edition #{availableEditions.find(e => e.price === floorPrice)?.edition}
                                    </Typography>
                                </div>
                            </div>

                            <Button
                                variant="contained"
                                fullWidth
                                style={{
                                    backgroundColor: "#fff",
                                    color: "#000",
                                    fontWeight: "bold",
                                    marginBottom: 12
                                }}
                            >{t("components.post_dialog.buy_now", {
                                floorPrice: floorPrice,
                                currency: currency
                            })}</Button>

                            <Button
                                variant="outlined"
                                fullWidth
                                style={{
                                    borderColor: "#666",
                                    color: "#fff"
                                }}
                            >{t("components.post_dialog.view_all_available", {
                                availableEdition_count: availableEditions.length
                            })}</Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card style={{ backgroundColor: "#0f0f0f", marginBottom: 20, borderRadius: 12 }}>
                        <CardContent>
                            <Typography variant="subtitle1" style={{ color: "#fff", fontWeight: "bold", marginBottom: 16 }}>
                                {t("components.post_dialog.no_editions_for_sale")}
                            </Typography>

                            <div style={{ textAlign: "center", padding: "20px 0" }}>
                                <Typography variant="body1" style={{ color: "#888", marginBottom: 16 }}>{t("components.post_dialog.all_editions_are_currently_held_by_collectors", {
                                    maxEditions: maxEditions
                                })}</Typography>

                                {avgSalePrice > 0 && (
                                    <Typography variant="body2" style={{ color: "#666", marginBottom: 20 }}>{t("components.post_dialog.average_sale_price", {
                                        avgSalePrice: avgSalePrice.toFixed(0),
                                        currency: currency
                                    })}</Typography>
                                )}
                            </div>

                            <Button
                                variant="contained"
                                fullWidth
                                style={{
                                    backgroundColor: "#000000",
                                    color: "#fff",
                                    fontWeight: "bold",
                                    marginBottom: 12
                                }}
                            >
                                {t("components.post_dialog.make_collection_offer")}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* All Editions */}
                <Card style={{ backgroundColor: "#1a1a1a", marginBottom: 20, borderRadius: 12 }}>
                    <CardContent>
                        <Typography variant="subtitle1" style={{ color: "#fff", fontWeight: "bold", marginBottom: 16 }}>
                            {t("components.post_dialog.all_editions")}
                        </Typography>
                        {editionsData.map((ed) => (
                            <EditionRow key={ed.edition} edition={ed} />
                        ))}
                    </CardContent>
                </Card>

                {/* Ownership History */}
                <Card style={{ backgroundColor: "#1a1a1a", marginBottom: 20, borderRadius: 12 }}>
                    <CardContent>
                        <Typography variant="subtitle1" style={{ color: "#fff", fontWeight: "bold", marginBottom: 16 }}>
                            {t("components.post_dialog.ownership_history")}
                        </Typography>
                        <div style={{ borderLeft: "2px solid #333", marginLeft: 8, paddingLeft: 16 }}>
                            {ownershipHistory.map((event, index) => (
                                <OwnershipEvent key={index} event={event} index={index} />
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Collections */}
                <Card style={{ backgroundColor: "#1a1a1a", marginBottom: 20, borderRadius: 12 }}>
                    <CardContent>
                        <Typography variant="subtitle1" style={{ color: "#fff", fontWeight: "bold", marginBottom: 8 }}>
                            {t("components.post_dialog.collections")}
                        </Typography>
                        <List>
                            {collections.map((collection) => (
                                <CollectionItem key={collection.id} collection={collection} />
                            ))}
                        </List>
                    </CardContent>
                </Card>

                {/* Actions */}
                <Card style={{ backgroundColor: "#1a1a1a", borderRadius: 12 }}>
                    <CardContent>
                        <List>
                            <ListItem button style={{ borderRadius: 8 }}>
                                <ListItemIcon><ShareRounded style={{ color: "#666" }} /></ListItemIcon>
                                <ListItemText primary={t("components.post_dialog.share")} />
                            </ListItem>
                            <ListItem button style={{ borderRadius: 8 }}>
                                <ListItemIcon><PrintRounded style={{ color: "#666" }} /></ListItemIcon>
                                <ListItemText primary={t("components.post_dialog.print")} />
                            </ListItem>
                            <ListItem button style={{ borderRadius: 8 }}>
                                <ListItemIcon><SecurityRounded style={{ color: "#666" }} /></ListItemIcon>
                                <ListItemText primary={t("components.post_dialog.report")} />
                            </ListItem>
                        </List>
                    </CardContent>
                </Card>
            </div>
        </div>

        {/* Coming-soon overlay — sticky card stays in view while the blurred preview scrolls */}
        <div style={STYLE_NFT_OVERLAY}>
            <div style={STYLE_NFT_OVERLAY_CARD}>
                <div style={STYLE_NFT_OVERLAY_ICON_WRAP}>
                    <HourglassEmptyRounded style={STYLE_NFT_OVERLAY_ICON} />
                </div>
                <Typography variant="h6" style={STYLE_NFT_OVERLAY_TITLE}>
                    {t("words.coming_soon")}
                </Typography>
                <Typography variant="body2" style={STYLE_NFT_OVERLAY_CAPTION}>
                    {t("components.post_dialog.the_nft_marketplace_is_on_its_way")}
                </Typography>
            </div>
        </div>
    </div>
), function (a, b){return a.id === b.id; });

/* ══════════════════════════════════════════════════════════════════════
 * PERF: Memoized bottom-bar components — each bar only re-renders
 * when its own slice of state changes, not on every parent dispatch.
 * ══════════════════════════════════════════════════════════════════════ */

const BottomBarActions = React.memo(function BottomBarActions({
                                                                  visible, barStyle, api,
                                                                  upvoteLoading, downvoteLoading, voted,
                                                                  handleUpvote, handleDownvote,
                                                                  upVotesNumber, downVotesNumber,
                                                                  triggerPositiveVotes, triggerNegativeVotes,
                                                                  payout, data, voter
                                                              }) {
    useLanguage();
    return (
        <Fade in={visible} timeout={FADE_TIMEOUT_BOTTOMBAR}>
            <PaperCardActions
                api={api}
                style={barStyle}
                upvoteLoading={upvoteLoading} downvoteLoading={downvoteLoading}
                voted={voted} handleUpvote={handleUpvote} handleDownvote={handleDownvote}
                upVotesNumber={upVotesNumber} downVotesNumber={downVotesNumber}
                triggerPositiveVotes={triggerPositiveVotes} triggerNegativeVotes={triggerNegativeVotes}
                payout={payout} data={data} voter={voter} />
        </Fade>
    );
}, function (a, b) {
    return a.visible === b.visible && a.voted === b.voted
        && a.upvoteLoading === b.upvoteLoading && a.downvoteLoading === b.downvoteLoading
        && a.upVotesNumber === b.upVotesNumber && a.downVotesNumber === b.downVotesNumber
        && a.payout === b.payout && a.data === b.data && a.barStyle === b.barStyle
        && a.voter === b.voter;
});

const BottomBarComments = React.memo(function BottomBarComments({
                                                                    visible, barStyle, classes,
                                                                    replyTarget, editTarget, commentSending, accountImage, dataAuthorUsername,
                                                                    onClearReply, onCancelEdit, onSubmitComment, onCommentKeyDown, account
                                                                }) {
    useLanguage();
    const loggedOut = !account;
    const padding = (replyTarget || editTarget) ? "8px 16px 12px" : "12px 16px";
    const fieldLabel = editTarget
        ? "Edit your comment"
        : replyTarget
            ? t("words.reply_to", {
                username: replyTarget.username || (replyTarget.author || {}).username
            })
            : t("words.reply_to_dataauthorusername", {
                dataAuthorUsername: dataAuthorUsername
            });
    return (
        <Fade in={visible} timeout={FADE_TIMEOUT_BOTTOMBAR}>
            <div style={{ ...barStyle, padding }}>
                {editTarget ? (
                    <div style={STYLE_REPLY_ROW}>
                        <Typography variant="caption" style={STYLE_REPLY_CAPTION}>
                            <EditRounded style={{ fontSize: 13, verticalAlign: "text-bottom", marginRight: 4 }} />
                            {t("words.editing_your_comment_saving_broadcasts_the_cha")}
                        </Typography>
                        <IconButton size="small" style={STYLE_REPLY_CLOSE_BTN} onClick={onCancelEdit}>
                            <CloseIcon style={STYLE_REPLY_CLOSE_ICON} />
                        </IconButton>
                    </div>
                ) : replyTarget && (
                    <div style={STYLE_REPLY_ROW}>
                        <Typography variant="caption" style={STYLE_REPLY_CAPTION}><T
                            k="words.replying_to_0_username_0"
                            vars={{
                                username: replyTarget.username || (replyTarget.author || {}).username
                            }}
                            slots={[<span style={STYLE_REPLY_USERNAME} key="0" />]} /></Typography>
                        <IconButton size="small" style={STYLE_REPLY_CLOSE_BTN} onClick={onClearReply}>
                            <CloseIcon style={STYLE_REPLY_CLOSE_ICON} />
                        </IconButton>
                    </div>
                )}
                <Grid container spacing={1} alignItems="center">
                    <Grid item>
                        <Avatar style={STYLE_COMMENT_AVATAR} src={accountImage} />
                    </Grid>
                    <Grid item xs>
                        {loggedOut ? (
                            <Tooltip title={t("words.log_in_or_create_an_account_to")} arrow>
                                <div>
                                    <TextField fullWidth={true} type="text"
                                               className={classes.comment} id="comment-textfield" name="comment-textfield"
                                               label={t("words.reply_to_dataauthorusername", {
                                                   dataAuthorUsername: dataAuthorUsername
                                               })}
                                               disabled={true} />
                                </div>
                            </Tooltip>
                        ) : (
                            <TextField fullWidth={true} autoFocus={visible} type="text"
                                       className={classes.comment} id="comment-textfield" name="comment-textfield"
                                       label={fieldLabel}
                                       disabled={commentSending}
                                       onKeyDown={onCommentKeyDown} />
                        )}
                    </Grid>
                    <Grid item>
                        {loggedOut ? (
                            <Tooltip title={t("words.log_in_or_create_an_account_to")} arrow>
                                <span>
                                    <IconButton className={classes.commentSendButton} disabled={true}>
                                        <SendRounded />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        ) : (
                            <Tooltip title={editTarget ? "Save the edit" : "Send"} arrow>
                                <span>
                                    <IconButton className={classes.commentSendButton} onClick={onSubmitComment} disabled={commentSending}>
                                        {commentSending ? <CircularProgress size={24} style={STYLE_REPLY_CAPTION} /> : editTarget ? <EditRounded /> : <SendRounded />}
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                    </Grid>
                </Grid>
                <ToxicityWatcher targetId="comment-textfield" label="comment" style={{ paddingLeft: 48 }} />
            </div>
        </Fade>
    );
}, function (a, b) {
    return a.visible === b.visible && a.commentSending === b.commentSending
        && a.replyTarget === b.replyTarget && a.editTarget === b.editTarget
        && a.accountImage === b.accountImage
        && a.dataAuthorUsername === b.dataAuthorUsername && a.barStyle === b.barStyle
        && a.account === b.account;
});

const BottomBarNFT = React.memo(function BottomBarNFT({ visible, barStyle }) {
    useLanguage();
    return (
        <Fade in={visible} timeout={FADE_TIMEOUT_BOTTOMBAR}>
            <div style={{ ...barStyle, padding: "12px 16px" }}>
                {/* Blurred + inert while the NFT marketplace is coming soon */}
                <div style={STYLE_NFT_BAR_DISABLED} aria-hidden="true">
                    <Grid container spacing={1} alignItems="center">
                        {availableEditions.length > 0 ? (
                            <>
                                <Grid item xs>
                                    <div style={STYLE_NFT_BAR_ITEMS}>
                                        <div>
                                            <Typography variant="caption" style={STYLE_NFT_BAR_LABEL}>{t("components.post_dialog.best_price_2")}</Typography>
                                            <Typography variant="h6" style={STYLE_NFT_BAR_VALUE}>{floorPrice} {currency}</Typography>
                                        </div>
                                        <div>
                                            <Typography variant="caption" style={STYLE_NFT_BAR_LABEL}>{t("components.post_dialog.available")}</Typography>
                                            <Typography variant="body2" style={STYLE_NFT_BAR_AVAILABLE}>{availableEditions.length} editions</Typography>
                                        </div>
                                    </div>
                                </Grid>
                                <Grid item>
                                    <Button variant="contained" style={STYLE_NFT_BUY_BTN}>{t("components.post_dialog.buy_now_2")}</Button>
                                </Grid>
                            </>
                        ) : (
                            <>
                                <Grid item xs>
                                    <div>
                                        <Typography variant="body2" style={STYLE_NFT_NO_SALE}>{t("components.post_dialog.no_editions_for_sale_2")}</Typography>
                                        <Typography variant="caption" style={STYLE_NFT_OFFER_HINT}>{t("components.post_dialog.make_an_offer_to_all_holders")}</Typography>
                                    </div>
                                </Grid>
                                <Grid item>
                                    <Button variant="contained" style={STYLE_NFT_OFFER_BTN}>{t("components.post_dialog.make_offer")}</Button>
                                </Grid>
                            </>
                        )}
                    </Grid>
                </div>
            </div>
        </Fade>
    );
}, function (a, b) { return a.visible === b.visible && a.barStyle === b.barStyle; });

/* ══════════════════════════════════════════════════════════════════════
 * PERF: Memoized VotesView — prevents re-render of the VirtualizedList
 * when unrelated state (comments, votes, hidden) changes.
 * ══════════════════════════════════════════════════════════════════════ */
const VotesView = React.memo(function VotesView({ authorsEntries, votesRenderer }) {
    useLanguage();
    return (
        <AutoSizer disableHeight>
            {({ width }) => (
                <VirtualizedList noRowsRenderer={NOOP} scrollToIndex={NOOP}
                                 height={160} overscanRowCount={1}
                                 rowCount={authorsEntries.length} rowHeight={72}
                                 rowRenderer={votesRenderer} width={width} />
            )}
        </AutoSizer>
    );
}, function (a, b) { return a.authorsEntries === b.authorsEntries && a.votesRenderer === b.votesRenderer; });

/* ══════════════════════════════════════════════════════════════════════
 * PERF: DrawerCardInner — the entire Card interior (header, tabs,
 * swipeable views, bottom bars).  Wrapped in React.memo so it skips
 * re-render when only image-animation state changes (_hidden, zoom,
 * _size, _download_loading).  This is the single biggest render-cost
 * cut: every arrow-nav dispatch({}) no longer traverses this tree.
 * ══════════════════════════════════════════════════════════════════════ */
const DrawerCardInner = React.memo(function DrawerCardInner({
                                                                /* layout */ classes, open, _view_mobile_opened, _view_right_mobile_enabled,
                                                                /* header */ data, _hidden2, locales, openAuthorFromData, menuToggle,
                                                                /* tabs   */ tab_value, handleTabChange, handleChangeIndex,
                                                                /* details */ metadata, type, kb, _copied, handleTagClick, handleDownloadArtwork, handleOpenLicenseDialog, handleCopy,
                                                                isOwner, openEditPost,
                                                                isFavorite, onToggleFavorite,
                                                                /* comments */ _current_comments, _show_parent, _sorting, sortedComments, _comments_loading, api, account,
                                                                toggleShowParent, sliceReplies, handleSortingChange, showReplies, onLoadReplies, openAuthor, replyToComment,
                                                                startEditComment, requestDeleteComment,
                                                                focusKey, focusPathKeys,
                                                                /* votes  */ authorsEntries, votesRenderer,
                                                                /* bars   */ barStyle, payout, upVotesNumber, downVotesNumber,
                                                                _voted, _upvoteLoading, _downvoteLoading, upvoteToggle, downvoteToggle,
                                                                triggerPositiveVotes, triggerNegativeVotes,
                                                                /* comment bar */ _reply_target, _edit_target, _comment_sending, accountImage, dataAuthorUsername,
                                                                clearReplyTarget, cancelEditComment, submitComment, onCommentKeyDown,
                                                                /* card ref */ setMenuCardRefCb
                                                            }) {
    useLanguage();
    const tags = data.tags || EMPTY_TAGS;
    return (
        <Card ref={setMenuCardRefCb}
              className={classes.card + ((open && _view_mobile_opened) ? " opened " : " closed ") + (open ? " visible " : " hidden ")}>
            <Collapse timeout={COLLAPSE_TIMEOUT} in={tab_value < 1} className={classes.collapse}>
                <CardHeader
                    className={classes.cardHeader}
                    avatar={<Fade in={!_hidden2} timeout={FADE_TIMEOUT_AVATAR} key={_hidden2 ? "0" : "1"}><Avatar src={(data.author || {}).image} onClick={openAuthorFromData} /></Fade>}
                    action={<IconButton onClick={menuToggle}>{(_view_mobile_opened || !_view_right_mobile_enabled) ? <CloseIcon style={STYLE_ICON_GRAY} /> : <InfoOutlined style={STYLE_ICON_GRAY} />}</IconButton>}
                    title={<Fade in={!_hidden2} timeout={FADE_TIMEOUT_TITLE} key={_hidden2 ? "0" : "1"}><span>{data.title}</span></Fade>}
                    subheader={
                        <Fade in={!_hidden2} timeout={FADE_TIMEOUT_SUBHEADER} key={_hidden2 ? "0" : "1"}>
                            <span>
                                <Tooltip arrow title={new Date(data.date).toLocaleDateString(locales, TOOLTIP_DATE_OPTIONS)}>
                                    <span className={classes.subheaderDate}><LiveTimeAgo date={data.date || Date.now()} /></span>
                                </Tooltip>
                                <span className={classes.subheaderBy}> by </span>
                                <Tooltip title={"@" + (data.author || {}).username}>
                                    <span className={classes.subheaderName} onClick={openAuthorFromData}>{(data.author || {}).name}</span>
                                </Tooltip>
                            </span>
                        </Fade>
                    } />
            </Collapse>
            <Fade in={!_hidden2} timeout={FADE_TIMEOUT_TABS} key={_hidden2 ? "0" : "1"}>
                <Tabs style={{ transform: `translateY(${tab_value < 1 ? 72 : 16}px)` }}
                      className={classes.cardTabs} value={tab_value} variant="fullWidth"
                      indicatorColor="primary" textColor="primary" onChange={handleTabChange} fullwidth={true}>
                    <Tab icon={<DescriptionRounded />} />
                    <Tab icon={<CommentRounded />} />
                    <Tab icon={<LabelRounded />} />
                </Tabs>
            </Fade>
            <Fade in={!_hidden2} timeout={FADE_TIMEOUT_SWIPEABLE} key={_hidden2 ? "0" : "1"}>
                <SwipeableViews ignoreNativeScroll={true} containerStyle={SWIPEABLE_CONTAINER_STYLE}
                                animateHeight={false} animateTransitions={true} disableLazyLoading={true}
                                resistance={true} springConfig={SWIPEABLE_SPRING}
                                index={tab_value} onChangeIndex={handleChangeIndex} disabled={false} key="swipe-able-view">
                    <CardContent key="view-0" style={STYLE_CARDCONTENT_0}>
                        <DetailsView id={data.id} data={data} metadata={metadata} classes={classes} type={type} kb={kb}
                                     tags={tags} onTagClick={handleTagClick} onDownloadArtwork={handleDownloadArtwork}
                                     onOpenLicenseDialog={handleOpenLicenseDialog} copied={_copied} onCopy={handleCopy}
                                     isOwner={isOwner} onEditPost={openEditPost}
                                     isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
                    </CardContent>
                    <CardContent key="view-1" style={STYLE_CARDCONTENT_1}>
                        <CommentsView id={data.id} currentComments={_current_comments} showParent={_show_parent}
                                      sorting={_sorting} comments={sortedComments} classes={classes} locales={locales}
                                      commentsLoading={_comments_loading} api={api} account={account}
                                      focusKey={focusKey} focusPathKeys={focusPathKeys}
                                      onToggleShowParent={toggleShowParent} onSliceReplies={sliceReplies}
                                      onSortingChange={handleSortingChange} onShowReplies={showReplies} onLoadReplies={onLoadReplies}
                                      onOpenAuthor={openAuthor} onReply={replyToComment}
                                      onEditComment={startEditComment} onDeleteComment={requestDeleteComment} />
                    </CardContent>
                    <CardContent key="view-2" style={STYLE_CARDCONTENT_2}>
                        <NFTView id={data.id} data={data} />
                    </CardContent>
                    <CardContent key="view-3" style={STYLE_CARDCONTENT_3}>
                        <VotesView authorsEntries={authorsEntries} votesRenderer={votesRenderer} />
                    </CardContent>
                </SwipeableViews>
            </Fade>
            <BottomBarActions
                visible={tab_value === 0 && !_hidden2} barStyle={barStyle} api={api}
                upvoteLoading={_upvoteLoading} downvoteLoading={_downvoteLoading}
                voted={_voted} handleUpvote={upvoteToggle} handleDownvote={downvoteToggle}
                upVotesNumber={upVotesNumber} downVotesNumber={downVotesNumber}
                triggerPositiveVotes={triggerPositiveVotes} triggerNegativeVotes={triggerNegativeVotes}
                payout={payout} data={data} voter={account} />
            <BottomBarComments
                visible={tab_value === 1 && !_hidden2} barStyle={barStyle} classes={classes}
                replyTarget={_reply_target} editTarget={_edit_target} commentSending={_comment_sending}
                accountImage={accountImage} dataAuthorUsername={dataAuthorUsername}
                onClearReply={clearReplyTarget} onCancelEdit={cancelEditComment}
                onSubmitComment={submitComment} onCommentKeyDown={onCommentKeyDown}
                account={account} />
            <BottomBarNFT
                visible={tab_value === 2 && !_hidden2} barStyle={barStyle} />
        </Card>
    );
}, function (a, b) {
    /* Skip re-render when only image-side state changed (_hidden, zoom, _size, _download_loading).
     * Check every drawer-relevant prop; callbacks are stable (useCallback) so identity-equal. */
    if (a.data !== b.data || a._hidden2 !== b._hidden2 || a.open !== b.open) return false;
    if (a.tab_value !== b.tab_value || a._view_mobile_opened !== b._view_mobile_opened) return false;
    if (a._view_right_mobile_enabled !== b._view_right_mobile_enabled) return false;
    if (a._voted !== b._voted || a._upvoteLoading !== b._upvoteLoading || a._downvoteLoading !== b._downvoteLoading) return false;
    if (a.upVotesNumber !== b.upVotesNumber || a.downVotesNumber !== b.downVotesNumber || a.payout !== b.payout) return false;
    if (a._comment_sending !== b._comment_sending || a._reply_target !== b._reply_target) return false;
    if (a._edit_target !== b._edit_target || a.isOwner !== b.isOwner || a.account !== b.account) return false;
    if (a.isFavorite !== b.isFavorite) return false;
    if (a._sorting !== b._sorting || a._comments_loading !== b._comments_loading) return false;
    if (a._show_parent !== b._show_parent || a._current_comments !== b._current_comments) return false;
    if (a.sortedComments !== b.sortedComments || a.authorsEntries !== b.authorsEntries) return false;
    if (a.metadata !== b.metadata || a._copied !== b._copied) return false;
    /* Deep-check metadata fields: Preact's batching can merge two patchReducer
     * calls such that the metadata reference doesn't change between renders
     * even though the content did (reset → real data in the same tick). */
    if (a.metadata && b.metadata) {
        if (a.metadata.width !== b.metadata.width || a.metadata.height !== b.metadata.height) return false;
        if ((a.metadata.colors || []).length !== (b.metadata.colors || []).length) return false;
    }
    if (a.kb !== b.kb || a.type !== b.type) return false;
    if (a.barStyle !== b.barStyle || a.accountImage !== b.accountImage) return false;
    if (a.locales !== b.locales) return false;
    return true;
});

/* PERF: Stable empty array reference for tags fallback */
const EMPTY_TAGS = Object.freeze([]);

/* PERF: Hoisted Intl date format options — avoids new object per render */
const TOOLTIP_DATE_OPTIONS = Object.freeze({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
// ── Shared layout constants ─────────────────────────────────────────
// Single source of truth for the dialog's chrome geometry. The JSS
// styles below AND the arithmetic view box in computeSize() both read
// these, so the JS math can never drift from the CSS it mirrors.
// MOBILE_BREAKPOINT pairs with theme.breakpoints.down("sm") (960 in
// this theme) — a JSS media query can't read a JS constant, so if the
// theme's sm value ever changes, change this with it.
const DRAWER_WIDTH = 480;
const MOBILE_BREAKPOINT = 960;

const STYLE_ROOT_CONTAINER = Object.freeze({ userSelect: "none", width: "100%", height: "100%", display: "flex", overflow: "hidden", contain: "size style layout" });
const STYLE_CLOSE_OVERLAY = Object.freeze({ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" });
const STYLE_DOWNLOAD_WRAP = Object.freeze({ zIndex: 1, top: 12, left: 12, position: "absolute", margin: "12px", display: "relative" });
const STYLE_ARROW_PREV = Object.freeze({ transform: "rotate(180deg)" });
const STYLE_IMG_ANIM_INNER = Object.freeze({
    userSelect: "none", touchAction: "none", pointerEvents: "none",
    transformOrigin: "50% 50%",
    contain: "layout style",
});
const STYLE_BLUR_1 = Object.freeze({ contain: "strict", contentVisibility: "auto", userSelect: "none", touchAction: "none", pointerEvents: "none", position: "absolute", zIndex: -2, width: "100%", height: "100%", filter: "blur(108px) brightness(1.314)" });
const STYLE_BLUR_2 = Object.freeze({ contain: "strict", contentVisibility: "auto", userSelect: "none", touchAction: "none", pointerEvents: "none", position: "absolute", zIndex: -1, width: "100%", height: "100%", filter: "blur(192px) brightness(1.618)" });
const STYLE_CARDCONTENT_0 = Object.freeze({ paddingBottom: 72, display: "inline-block", overflow: "overlay", width: "100%", flexGrow: "1", paddingTop: 72 });
const STYLE_CARDCONTENT_1 = Object.freeze({ paddingBottom: 96, display: "inline-block", overflow: "overlay", width: "100%", flexGrow: "1", paddingTop: 72 });
const STYLE_CARDCONTENT_2 = Object.freeze({ paddingBottom: 0, display: "inline-block", overflow: "overlay", width: "100%", flexGrow: "1", paddingTop: 72 });
const STYLE_CARDCONTENT_3 = Object.freeze({ paddingBottom: 0, display: "inline-block", overflow: "overlay", width: "100%", flexGrow: "1", paddingTop: 88 });

/* PERF #21: Hoisted Fade/Collapse timeout configs — avoids new object per render */
/* FIX: Reduced appear/enter times — card entrance handles the reveal drama,
 * content should pop in immediately, not cascade in over 500ms+ */
const FADE_TIMEOUT_AVATAR = Object.freeze({ appear: 150, enter: 150, exit: 200 });
const FADE_TIMEOUT_TITLE = Object.freeze({ appear: 150, enter: 150, exit: 200 });
const FADE_TIMEOUT_SUBHEADER = Object.freeze({ appear: 180, enter: 180, exit: 200 });
const FADE_TIMEOUT_TABS = Object.freeze({ appear: 200, enter: 200, exit: 200 });
const FADE_TIMEOUT_SWIPEABLE = Object.freeze({ appear: 200, enter: 200, exit: 200 });
const COLLAPSE_TIMEOUT = Object.freeze({ delay: 0, enter: 360, exit: 360 });
const SWIPEABLE_SPRING = Object.freeze({ tension: 450, friction: 60, duration: '300ms', easeFunction: 'cubic-bezier(0.280, 0.840, 0.420, 1)', delay: '25ms' });
const SWIPEABLE_CONTAINER_STYLE = Object.freeze({ height: "100%" });
const STYLE_ICON_GRAY = Object.freeze({ color: "#666" });
const STYLE_REPLY_ROW = Object.freeze({ display: "flex", alignItems: "center", marginBottom: 6, gap: 6 });
const STYLE_REPLY_CAPTION = Object.freeze({ color: "#888" });
const STYLE_REPLY_USERNAME = Object.freeze({ color: "#bbb" });
const STYLE_REPLY_CLOSE_BTN = Object.freeze({ padding: 2, marginLeft: 4 });
const STYLE_REPLY_CLOSE_ICON = Object.freeze({ fontSize: 14, color: "#666" });
const STYLE_COMMENT_AVATAR = Object.freeze({ width: 48, height: 48, cursor: "pointer", borderRadius: "16px" });

/* PERF #22: Hoisted bottom-bar and NFT inline styles — avoid allocation per render */
const STYLE_BOTTOM_BAR_BASE = Object.freeze({ backgroundColor: "#101010", position: "fixed", bottom: 0 });
const STYLE_NFT_BAR_LABEL = Object.freeze({ color: "#888", display: "block" });
const STYLE_NFT_BAR_VALUE = Object.freeze({ color: "#fff", fontWeight: "bold" });
const STYLE_NFT_BAR_AVAILABLE = Object.freeze({ color: "#ffffff" });
const STYLE_NFT_BAR_ITEMS = Object.freeze({ display: "flex", alignItems: "center", gap: 12 });
const STYLE_NFT_BUY_BTN = Object.freeze({ backgroundColor: "#fff", color: "#000", fontWeight: "bold", minWidth: 120 });
const STYLE_NFT_NO_SALE = Object.freeze({ color: "#888" });
const STYLE_NFT_OFFER_HINT = Object.freeze({ color: "#666" });
const STYLE_NFT_OFFER_BTN = Object.freeze({ backgroundColor: "#ffffff", color: "#fff", fontWeight: "bold", minWidth: 120 });

/* "Coming soon" treatment for the NFT tab — blurred inert preview + sticky overlay.
 * The wrapper must stay overflow:visible: an overflow value other than visible here
 * would hijack the sticky containing scrollport from the CardContent scroller and
 * pin the overlay card to the top instead of keeping it in view while scrolling. */
const STYLE_NFT_COMING_SOON_WRAP = Object.freeze({ position: "relative" });
const STYLE_NFT_BLURRED = Object.freeze({ filter: "blur(9px)", opacity: 0.55, pointerEvents: "none", userSelect: "none" });
const STYLE_NFT_BAR_DISABLED = Object.freeze({ filter: "blur(5px)", opacity: 0.5, pointerEvents: "none", userSelect: "none" });
const STYLE_NFT_OVERLAY = Object.freeze({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "0px 16px", backgroundColor: "rgba(0, 0, 0, 0.25)" });
const STYLE_NFT_OVERLAY_CARD = Object.freeze({ position: "sticky", top: 120, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 340, padding: "28px 24px", borderRadius: 16, backgroundColor: "rgba(15, 15, 15, 0.9)", backdropFilter: "blur(8px)" });
const STYLE_NFT_OVERLAY_ICON_WRAP = Object.freeze({ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 });
const STYLE_NFT_OVERLAY_ICON = Object.freeze({ fontSize: 36, color: "#fff" });
const STYLE_NFT_OVERLAY_TITLE = Object.freeze({ color: "#fff", fontWeight: "bold", marginBottom: 8 });
const STYLE_NFT_OVERLAY_CAPTION = Object.freeze({ color: "#888" });
const FADE_TIMEOUT_BOTTOMBAR = 400;
// Visibility is NOT declared here on purpose. If React owned the visibility
// channel via this frozen style, every re-render would re-apply whichever
// value is baked in — clobbering the imperative `visibility = "visible"`
// flip that `setImgd` performs after a fresh paint, and producing exactly
// the "old image flashes / new image never appears" symptoms we're trying
// to avoid. Visibility is owned exclusively by imperative DOM writes:
// `setCanvasRefCb` and `clearCanvas` set it to "hidden"; `setImgd` flips
// it to "visible" only once the bitmap is sized AND painted at the new
// `_size`. Width, height, and border-radius remain React-managed because
// they need to track `_size`/`renderer`/`zoom` reactively.
const STYLE_CANVAS_CONTEXT = Object.freeze({ zIndex: 1, userSelect: "none", touchAction: "none", pointerEvents: "initial" });

/* PERF: Stable callbacks for VirtualizedList — avoids new function allocation per render */
const NOOP = () => {};
const PREVENT_CONTEXT = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };

const styles = (theme) => ({
    backdrop: {
        zIndex: theme.zIndex.drawer + 1,
        backdropFilter: "blur(9px) grayscale(1)",
        overflow: "hidden",
        userSelect: "none",
    },
    drawer: {
        width: 384,
        [theme.breakpoints.down("sm")]: {
            width: "100%",
        }
    },
    drawerPaper: {
        padding: "16px 16px"
    },
    showAllParentsButton: {
        border: "1px solid rgb(255 255 255 / 70%)",
        color: "rgb(255 255 255 / 70%)",
        marginTop: 32,
        "&:hover": {
            border: "1px solid rgb(255 255 255 / 100%)",
            color: "rgb(255 255 255 / 100%)",
        }
    },
    list: {
        "& .MuiListSubheader-root": {
            fontSize: "1rem !important"
        }
    },
    colorBadges: {
        width: "100%",
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        [theme.breakpoints.down("sm")]: {
            gap: "4px",
        },
        justifyContent: "flex-start",
        padding: "12px 0px 24px 24px",
    },
    colorBadge: {
        display: "flex",
        width: 18,
        height: 18,
        borderRadius: "4px",
        cursor: "pointer"
    },
    cardHeader: {
        alignItems: "flex-start",
        "&.MuiCardHeader-root": {
            transform: "translateZ(10px)",
            backgroundColor: "#000",
            boxShadow: "0px 0px 6px 12px #000000",
            position: "relative"
        },
        "& .MuiCardHeader-title": {
            fontWeight: "bold",
            fontFamily: '"Industry Book", "Normative Pro"',
            color: "#fff",
            cursor: "pointer",
            whiteSpace: "nowrap",
            width: "calc(100% - 48px)",
            overflow: "hidden",
            textOverflow: "ellipsis"
        },
        "& .MuiAvatar-root": {
            cursor: "pointer",
            borderRadius: "14px"
        }
    },
    repliesGroup: {
        marginTop: 4,
        display: "flex",
        float: "right",
        flexFlow: "row-reverse",
        gap: 2,
        "& .MuiAvatar-root": {
            cursor: "pointer",
            borderRadius: "14px"
        },
        "& .MuiAvatar-root::after": {
            background: "#00000080 url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjOTk5OTk5Ij48cGF0aCBkPSJtMjU2LTIwMC01Ni01NiAyMjQtMjI0LTIyNC0yMjQgNTYtNTYgMjI0IDIyNCAyMjQtMjI0IDU2IDU2LTIyNCAyMjQgMjI0IDIyNC01NiA1Ni0yMjQtMjI0LTIyNCAyMjRaIi8+PC9zdmc+\")",
            content: "''",
            position: "absolute",
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            backdropFilter: "brightness(0.5)",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "opacity(0)",
            transition: "filter 225ms cubic-bezier(0.4, 0, 0.2, 1) 35ms",
        },
        "& .MuiAvatar-root:hover::after": {
            filter: "opacity(1)",
            transition: "filter 175ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    subheaderName: {
        color: "#fff",
        cursor: "pointer",
    },
    subheaderBy: {
        color: "#aaa"
    },
    subheaderDate: {
        color: "#ddd"
    },
    image: {
        width: "100%",
        cursor: "pointer",
        userSelect: "none",
        contain: "style layout"
    },
    hidden: {
        filter: "opacity(0)",
        transform: "scale(.5)",
        transformOrigin: "50% 50%",
        transition: "transform 220ms cubic-bezier(0.3, 0, 0.8, 0.15), filter 260ms cubic-bezier(0.3, 0, 0.8, 0.15)",
        willChange: "transform, filter, opacity",
        backfaceVisibility: "hidden",
        contain: "layout style",
    },
    appear: {
        filter: "opacity(1)",
        transform: "scale(1)",
        transformOrigin: "50% 50%",
        transition: "transform 350ms cubic-bezier(0.2, 0.9, 0.3, 1), filter 320ms cubic-bezier(0.2, 0.9, 0.3, 1)",
        willChange: "auto",
        backfaceVisibility: "hidden",
        contain: "layout style",
    },
    dismiss: {
        transformOrigin: "50% 50%",
        animation: "$artDismiss 200ms cubic-bezier(0.4, 0, 1, 1) forwards",
        willChange: "transform, filter",
        backfaceVisibility: "hidden",
        "@global": {
            "@keyframes artDismiss": {
                "0%":   { transform: "scale(1)",    filter: "opacity(1)" },
                "30%":  { transform: "scale(1.06)", filter: "opacity(.4)" },
                "100%": { transform: "scale(0.55)", filter: "opacity(0)" },
            }
        }
    },
    bounceAppear: {
        transformOrigin: "50% 50%",
        animation: "$artBounceIn 400ms cubic-bezier(0.2, 0.9, 0.3, 1) forwards",
        willChange: "transform, filter",
        backfaceVisibility: "hidden",
        contain: "layout style",
        "@global": {
            "@keyframes artBounceIn": {
                "0%":   { transform: "scale(0.6)",  filter: "opacity(0)" },
                "100%": { transform: "scale(1)",    filter: "opacity(1)" },
            }
        }
    },
    viewLeft: {
        width: `calc(100% - ${DRAWER_WIDTH}px)`,
        position: "inherit",
        contain: "layout style size",
        transform: "translateZ(0px)",
        zIndex: -1,
        [theme.breakpoints.down("sm")]: {
            width: "100%",
        }
    },
    viewRight: {
        width: `${DRAWER_WIDTH}px`,
        padding: "16px 16px 16px 0px",
        contain: "size style layout",
        willChange: "transform, filter",
        animation: "$slideInFromRight both 500ms cubic-bezier(0.4, 0, 0.2, 1) 80ms",
        "@global": {
            "@keyframes slideInFromRight": {
                "0%": {
                    transform: "translateX(420px) !important",
                    filter: "opacity(0)"
                },
                "100%": {
                    transform: "translateX(0px) !important",
                    filter: "opacity(1)"
                },
            }
        },
        "& > .hidden": {
            animation: "none",
            contain: "size style layout",
        },
        "& > .visible": {},
        [theme.breakpoints.down("sm")]: {
            animation: "none !important",
            width: "100%",
            height: "100%",
            position: "fixed",
            top: "0px",
            padding: "0px",
            transform: "translateY(0px)",
            transition: "transform 260ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    viewRightNoAnim: {
        width: `${DRAWER_WIDTH}px`,
        padding: "16px 16px 16px 0px",
        contain: "size style layout",
        animation: "none !important",
        "& > .hidden": {
            animation: "none",
            contain: "size style layout",
        },
        "& > .visible": {},
        [theme.breakpoints.down("sm")]: {
            width: "100%",
            height: "100%",
            position: "fixed",
            top: "0px",
            padding: "0px",
            transform: "translateY(0px)",
            transition: "transform 260ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    /* Prerender: drawer is in the DOM tree (content renders) but completely
     * invisible. When _hidden2 flips false we swap to viewRight/viewRightHidden
     * and the animation/transition triggers fresh with content already painted. */
    viewRightPrerender: {
        width: `${DRAWER_WIDTH}px`,
        padding: "16px 16px 16px 0px",
        contain: "size style layout",
        filter: "opacity(0)",
        transform: "translateX(420px)",
        pointerEvents: "none",
        animation: "none !important",
        [theme.breakpoints.down("sm")]: {
            width: "100%",
            height: "100%",
            position: "fixed",
            top: "0px",
            padding: "0px",
            transform: "translateY(100%)",
            filter: "opacity(0)",
        }
    },
    viewRightHidden: {
        width: `${DRAWER_WIDTH}px`,
        padding: "16px",
        overflow: "hidden",
        [theme.breakpoints.down("sm")]: {
            width: "100%",
            height: "100%",
            position: "fixed",
            bottom: "0px",
            transform: "translateY(calc(100% - 84px))",
            transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1) 80ms",
        }
    },
    viewRightHiddenNoDelay: {
        width: `${DRAWER_WIDTH}px`,
        padding: "16px",
        overflow: "hidden",
        [theme.breakpoints.down("sm")]: {
            width: "100%",
            height: "100%",
            position: "fixed",
            bottom: "0px",
            transform: "translateY(calc(100% - 84px))",
            transition: "transform 180ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    infoButton: {
        position: "absolute",
        right: 16,
        bottom: 16,
        display: "none",
        [theme.breakpoints.down("sm")]: {
            display: "inherit",
        }
    },
    closeButton: {
        position: "absolute",
        top: 16,
        right: 16,
        display: "none",
        [theme.breakpoints.down("sm")]: {
            display: "inherit",
        }
    },
    // ── Deleted / unavailable / loading post ─────────────────────────────
    // Replaces the artwork canvas AND the details drawer entirely — there is
    // no artwork to decode and no metadata to show. Strictly greyscale, same
    // surface language as the rest of the dialog. Mirrors BlogPostDialog.
    unavailableClose: {
        position: "fixed",
        top: 24,
        right: 24,
        color: "#fff",
        zIndex: 100,
    },
    unavailableWrap: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
    },
    unavailableCard: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: "#101010",
        borderRadius: "42px",
        padding: "48px 32px",
        textAlign: "center",
        boxSizing: "border-box",
        [theme.breakpoints.down("sm")]: {
            borderRadius: "32px",
            padding: "40px 24px",
        },
    },
    unavailableIcon: {
        fontSize: 64,
        color: "#555",
    },
    unavailableTitle: {
        marginTop: 12,
        fontSize: "1.35rem",
        fontWeight: "bold",
        lineHeight: 1.25,
        color: "#fff",
        fontFamily: '"Industry Book", "Normative Pro"',
    },
    unavailableAuthorRow: {
        display: "inline-flex",
        alignItems: "center",
        marginTop: 20,
        padding: "6px 16px 6px 6px",
        borderRadius: "999px",
        backgroundColor: "#1a1a1a",
        cursor: "pointer",
        transition: "background-color 150ms ease",
        "&:hover": { backgroundColor: "#242424" },
    },
    unavailableAvatar: {
        width: 28,
        height: 28,
        borderRadius: "10px",
        marginRight: 10,
    },
    unavailableAuthorName: {
        fontSize: 14,
        color: "#ddd",
    },
    unavailableText: {
        marginTop: 20,
        fontSize: 14,
        lineHeight: 1.55,
        color: "#8a8a8a",
    },
    unavailableButton: {
        marginTop: 28,
        borderRadius: "999px",
        padding: "8px 28px",
        color: "#101010",
        backgroundColor: "#ffffff",
        textTransform: "none",
        fontSize: 14,
        "&:hover": { backgroundColor: "#e0e0e0" },
    },
    back: {
        zIndex: 1,
        cursor: "pointer",
        position: "absolute",
        left: 0,
        top: "calc(50% - 64px)",
        width: 128,
        height: 128,
        lineHeight: "128px",
        verticalAlign: "middle",
        textAlign: "center",
        [theme.breakpoints.down("sm")]: {
            width: 80,
            height: 80,
            top: "calc(50% - 40px)",
        }
    },
    forward: {
        zIndex: 1,
        cursor: "pointer",
        position: "absolute",
        right: 0,
        top: "calc(50% - 64px)",
        width: 128,
        height: 128,
        lineHeight: "128px",
        verticalAlign: "middle",
        textAlign: "center",
        [theme.breakpoints.down("sm")]: {
            width: 80,
            height: 80,
            top: "calc(50% - 40px)",
        }
    },
    arrowIcon: {
        color: "#ffffff41",
        width: 72,
        height: 72,
        margin: "28px",
        transition: "color 240ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        [theme.breakpoints.down("sm")]: {
            width: 48,
            height: 48,
            margin: "16px",
        },
        "&:hover": {
            color: "#FFFFFF82",
            transition: "color 120ms cubic-bezier(0.4, 0, 0.2, 1) 5ms",
        }
    },
    card: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: "100%",
        borderRadius: "32px !important",
        boxShadow: "0px 0px 16px 8px #00000070",
        /* OPT #6: touch-action none so we own all pointer events; scroll is
         * handled manually via JS when the drawer is open (fullscreen). */
        touchAction: "none",
        /* FIX: Block pull-to-refresh and overscroll rubber-banding */
        overscrollBehavior: "none",
        [theme.breakpoints.down("sm")]: {
            animation: "none",
            borderRadius: "32px 32px 0px 0px !important",
            "&.opened": {
                borderRadius: "0px 0px 0px 0px !important",
            },
            minHeight: "100%",
        },
        "& .MuiCardHeader-action": {
            margin: "0px !important",
            position: "absolute",
            top: 16,
            right: 16
        },
        "& .MuiAccordion-root.Mui-expanded": {
            margin: "0px !important"
        }
    },
    downloadButtonProgress: {
        color: "white",
        position: 'absolute',
        top: -8,
        left: -8,
        zIndex: 1,
    },
    circle: {
        strokeLinecap: "round"
    },
    chipTags: {
        lineHeight: "34px",
        gap: "8px",
        width: "100%",
        display: "flex",
        padding: "0px",
        flexWrap: "wrap",
        justifyContent: "flex-start",
        marginTop: "12px",
        "& .MuiChip-root": {
            cursor: "pointer",
            borderRadius: "12px",
            backgroundColor: "#1b1b1b",
            color: "#979797",
            transition: "background-color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms"
        },
        "& .MuiChip-root:hover": {
            backgroundColor: "#2a2a2a",
            color: "#e3e3e3",
        }
    },
    cardTabs: {
        transform: "translateZ(10px)",
        contain: "style layout",
        backgroundColor: "#171717",
        "& .MuiTab-root": {
            minWidth: "72px !important"
        },
        "& .MuiTab-textColorPrimary.Mui-selected": {
            backgroundColor: "transparent",
        },
        "& .MuiTab-textColorPrimary.Mui-selected .MuiTab-wrapper": {
            color: "#171717 !important"
        },
        "& .MuiTab-fullWidth": {
            backgroundColor: "transparent",
            color: "#989898",
            transition: "all 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
            borderRadius: "21px"
        },
        "& .MuiTab-fullWidth:hover": {
            backgroundColor: "rgba(255,255,255,0.06)"
        },
        "& span.MuiTabs-indicator": {
            zIndex: "-1",
            height: "48px",
            backgroundColor: "#c7c7c7",
            borderRadius: "21px",
            transform: "scale3d(0.875, 0.75, 1)"
        },
        margin: "0px 16px 0px 16px",
        width: "calc(100% - 48px)",
        borderRadius: "21px",
        position: "fixed",
        top: 16,
        left: 0,
        zIndex: 1,
        transition: "opacity 375ms cubic-bezier(0.4, 0, 0.2, 1), transform 360ms cubic-bezier(0.4, 0, 0.2, 1) 120ms !important"
    },
    collapse: {
        transform: "translateZ(10px)",
        contain: "size style layout",
        transition: "height 120ms cubic-bezier(0.4, 0, 0.2, 1) 0ms !important",
        height: "0px !important",
        "&.MuiCollapse-entered": {
            minHeight: "72px !important",
            height: "112px !important",
            transition: "min-height 120ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, height 120ms cubic-bezier(0.4, 0, 0.2, 1) 0ms !important"
        },
    },
    commentSendButton: {
        backgroundColor: "#ffffff17",
        "&:hover": {
            backgroundColor: "#ffffff24"
        }
    },
    /* OPT #14: CSS containment for the canvas wrapper to isolate repaints */
    canvasWrapper: {
        contain: "strict",
        contentVisibility: "auto",
        willChange: "auto",
    },
    heroTransition: {
        transition: "transform 420ms cubic-bezier(0.2, 0.9, 0.3, 1) !important",
        willChange: "transform !important",
        backfaceVisibility: "hidden",
    },
    heroAppear: {
        filter: "opacity(1)",
        transform: "none",
        transformOrigin: "50% 50%",
        willChange: "auto",
        contain: "layout style",
    },
    /* Class hook for the download button wrapper (its layout lives in the
     * inline STYLE_DOWNLOAD_WRAP) so closingChrome below can reach it.
     * display:block matches the div's computed default — purely a hook. */
    downloadWrap: { display: "block" },
    /* Reverse-hero close. Applied on the Backdrop root while the artwork
     * flies back onto its masonry card: the tint + blur clear so the feed
     * shows through behind the flying image, and every other layer of the
     * dialog (drawer, arrows, download control) fades out of its way and
     * stops catching clicks. blur(0)/grayscale(0) rather than `none` so the
     * backdrop-filter interpolates instead of snapping. The transition is
     * !important AND keeps `opacity` in the list because MUI's Fade writes
     * an inline `transition: opacity ...` on this node (handleEnter) that
     * would otherwise win over the class — opacity at 195ms preserves the
     * Backdrop's own leavingScreen fade once props.onClose fires. The
     * flying image itself is untouched — it lands on the card at full
     * opacity and that final Backdrop fade-out dissolves it into the
     * identical pixels of the card beneath. */
    closingChrome: {
        backgroundColor: "transparent !important",
        backdropFilter: "blur(0px) grayscale(0) !important",
        /* Click-through for the WHOLE dialog from the first frame of the
         * flight. The artwork needs 440 ms to land and the Backdrop's own
         * fade-out runs after that — for all of it this Portal was still
         * the topmost hit-test target, so a click aimed at another card in
         * the masonry underneath hit the backdrop (or STYLE_CLOSE_OVERLAY,
         * which spans viewLeft) and was swallowed: the user had to wait out
         * the close before they could open the next post. Taking the whole
         * subtree out of hit-testing lets that click land on the card, and
         * the host reopens us with the new post mid-flight — see the
         * reverse-hero abort in the props effect, which cancels this
         * flight's pending onClose so it can't close the post the user
         * just picked. Nothing in here needs to be clickable any more: the
         * close is already committed and onRequestClose early-returns
         * while inst.closingHero is set. */
        pointerEvents: "none",
        /* The canvas opts BACK IN to hit-testing on itself
         * (STYLE_CANVAS_CONTEXT sets `pointer-events: initial` inline so
         * wheel-zoom/drag reach it), and `none` on an ancestor does not
         * beat a descendant that re-enables it — the flying artwork would
         * go on eating exactly the clicks aimed at the region it is flying
         * through. !important because the declaration it has to outrank is
         * an inline one. */
        "& canvas": {
            pointerEvents: "none !important",
        },
        transition: "background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), backdrop-filter 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 195ms cubic-bezier(0.4, 0, 0.2, 1) !important",
        // The arrows sit inside MUI <Fade> wrappers, and an entered Fade
        // leaves INLINE `opacity: 1` (plus its own 900 ms inline
        // transition) on its child — inline style beats any normal class
        // rule, so without !important this fade-out never ran: the arrows
        // stayed at full opacity through the entire reverse-hero flight
        // and only vanished with the backdrop after landing. Important
        // declarations outrank inline styles in the cascade, so these two
        // win, and the 140 ms ramp has the arrows gone in the first third
        // of the 440 ms flight. downloadWrap isn't Fade-wrapped (no
        // inline opacity) — the !important is harmless there.
        "& $back, & $forward, & $downloadWrap": {
            opacity: "0 !important",
            pointerEvents: "none",
            transition: "opacity 140ms cubic-bezier(0.4, 0, 0.2, 1) !important",
        },
        "& $viewRight, & $viewRightNoAnim, & $viewRightHidden, & $viewRightHiddenNoDelay, & $viewRightPrerender": {
            opacity: 0,
            pointerEvents: "none",
            transition: "opacity 220ms cubic-bezier(0.4, 0, 0.2, 1)",
        },
    },
    /* Slow opacity fade-in for the two blur backplate <img>s. Applied
     * imperatively by setImgd at the same rAF tick that swaps the src,
     * so the new artwork's blur backplate ramps up from invisible to
     * full strength over ~1.6s — softer than the canvas's own snap-in
     * and visually pleasant on top of the hero zoom. Using `opacity` (not
     * `filter: opacity(...)`) leaves the existing blur/brightness filter
     * chain on STYLE_BLUR_1/2 untouched, which matters because Safari
     * can struggle to animate multi-function filter chains smoothly.
     *
     * The animation is set up so re-adding the class (e.g. on nav to
     * the next post) restarts the animation: we remove the class, force
     * a reflow, then re-add it — that pattern is in setImgd. */
    blurFadeIn: {
        animation: "$blurOpacityFade 1600ms cubic-bezier(0.2, 0.9, 0.3, 1) forwards",
        willChange: "opacity",
        "@global": {
            "@keyframes blurOpacityFade": {
                "0%":   { opacity: 0 },
                "100%": { opacity: 1 },
            },
        },
    },
    /* Tap-to-save overlay (post-encode). The watermark render/encode is async,
     * so the original click's transient activation is gone by the time it
     * resolves and the browser cancels a programmatic download. Instead we
     * show this overlay; a tap on the icon/filename re-issues the download
     * from inside a real user gesture. Fade-in of the icon/text is handled by
     * <Fade> components in the JSX (300 ms / 600 ms transitionDelay). */
    downloadOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: theme.zIndex.modal + 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        userSelect: "none",
        backgroundColor: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(12px)",
    },
    downloadOverlayInner: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        cursor: "pointer",
        padding: 24,
    },
    downloadOverlayIcon: {
        color: "#fff",
        width: 120,
        height: 120,
        [theme.breakpoints.down("sm")]: {
            width: 88,
            height: 88,
        },
    },
    downloadOverlayText: {
        color: "#fff",
        marginTop: 16,
        fontFamily: '"Industry Book", "Normative Pro"',
        fontSize: "1.25rem",
        wordBreak: "break-all",
        maxWidth: "80vw",
    },
});


/* ══════════════════════════════════════════════════════════════════════
 * DRAWER ↔ URL HASH SYNC
 *
 * The mapping lives in `constants.js` (POST_DRAWER_TAB_HASHES /
 * POST_DRAWER_HASH_TABS / parsePostDrawerHash) so other dialogs can
 * adopt the same scheme. Push/replace policy is encoded inline in the
 * state→URL effect below — see its block comment for the full rules.
 * ══════════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════════════
 * REDUCER — simple patch-merge, replaces the old setSt4te + forceUpdate.
 * Every dispatch({...}) creates a new state reference → triggers re-render.
 * ══════════════════════════════════════════════════════════════════════ */
const INITIAL_STATE = {
    open: false,
    // Reverse-hero close in progress: the artwork is flying back onto its
    // masonry card, so every other layer (backdrop tint, drawer, arrows,
    // download) fades out of its way — see classes.closingChrome.
    _closing: false,
    data: {},
    renderer: "square",
    mode: null,
    locales: "en",
    kb: 0,
    type: "",
    format: "png",
    _authors: [],
    _sorting: "Hype",
    _tab_value: 0,
    _hidden: true,
    _hidden2: true,
    _zoom_mode: 0,
    _view_mobile_opened: false,
    _view_right_mobile_enabled: (typeof window !== "undefined" ? (window.innerWidth || document.documentElement.clientWidth || 960) : 960) <= 960,
    _download_loading: false,
    _download_ready: null,
    _copied: false,
    _voted: 0,
    _initialVoted: 0,
    _upvoteLoading: false,
    _downvoteLoading: false,
    _license_dialog_opened: false,
    _license_base: baseLicenseData,
    _license_customization: null,
    _accounts: {},
    _comments: [],
    _current_comments: [],
    _show_parent: false,
    _comments_loading: false,
    // Deep-linked comment focus ("#replies&focus=<b64>"): the pinned comment
    // + the resolved key path from a top-level comment down to it.
    _focusComment: null,
    _focusPathKeys: [],
    _comment_sending: false,
    _reply_target: null,
    _edit_target: null,       // { comment, rawBody } — comment being edited via the bottom textfield
    _delete_target: null,     // comment pending the delete confirmation dialog
    _edit_post_open: false,   // EditPostDialog (post metadata) visibility
    _is_favorite: false,      // artwork bookmarked in the LacertaDB favorites store
    zoom: 1.33,
    metadata: { imgd: null, colors: [], width: 0, height: 0 },
    _size: {},
};

function patchReducer(prev, patch) {
    return { ...prev, ...patch };
}

/* ══════════════════════════════════════════════════════════════════════
 * INSTANCE VARS — non-reactive mutable state, replaces this._xxx
 * Lives in a useRef, never triggers re-render.
 * ══════════════════════════════════════════════════════════════════════ */
function createInst() {
    return {
        // Render tracking
        currentRenderId: 0,

        // Drag state
        dragging: false,
        dragStartX: 0, dragStartY: 0,
        dragOriginLeft: 0, dragOriginTop: 0,
        posLeft: 0, posTop: 0,
        currentZoom: 1.33,
        rafDragId: null,
        pendingDx: 0, pendingDy: 0,

        // Card drag
        cardDragging: false,
        cardYStart: 0, cardXStart: 0,
        cardYOffset: 0,
        rafCardId: null,
        pendingCardOffset: 0,
        cardPointerId: null,
        cardIsHidden: true,
        cardWrapperEl: null,
        cardScrolling: false,
        cardActiveScrollable: null,
        lastPointerY: 0,
        scrollVelocity: 0,
        scrollMomentumRaf: null,

        // Pinch
        pinchStartDist: null,
        startZoom: 1.33,
        twoPointer: false,
        twoPointerTimeout: null,
        activePointers: null,

        // Wheel
        rafWheelId: null,
        pendingWheelEvent: null,

        // Resize
        resizeRaf: null,

        // Hero animation
        heroAnimating: false,
        originRect: null,
        heroTransitionTimer: null,
        positionSetForId: null,
        drawerHasAppeared: false,

        // Reverse hero (close → fly back onto the masonry card). While
        // `closingHero` is set the outer-div transform belongs to the
        // flight — applyTransform (gestures) and re-renders must not
        // touch it. The timer fires props.onClose once the artwork lands.
        closingHero: false,
        closingHeroTimer: null,

        // Arrow nav
        navTransitioning: false,
        navDismissing: false,
        navBouncing: false,
        navDirection: null,
        navDismissTimer: null,
        navBounceTimer: null,
        navSafetyTimer: null,

        // Comment refresh
        commentRefreshTimer: null,

        // Delayed post-close cleanup (clears data/metadata/canvas a beat
        // after the Backdrop fade-out so we don't free the image mid-anim).
        closeResetTimer: null,

        // Caches
        cachedViews: null,
        cachedViewsKey: null,
        sortedCommentsCache: null,
        sortedCommentsCacheKey: null,
        sortedCommentsCacheRef: null,
        authorsEntriesCache: null,
        authorsEntriesCacheRef: null,
        swipeableScrollTarget: null,

        // View measurement
        viewMeasurement: {},

        // Drawer settings
        drawerSettings: { hysteresisClosed: 14, hysteresisOpened: 18, friction: 0.0333 },

        // Blur backplate atomic-swap state. The two <img> blur layers used
        // to render directly from `data.image`, which meant React committed
        // the new src synchronously while the canvas pipeline was still
        // mid-resize → a 1–3 frame window where the blur showed the new
        // post but the canvas still held the previous post's pixels (or
        // was momentarily blank), producing a visible flash during the
        // hero zoom. Solution: keep blur srcs in refs and flip them
        // imperatively at the exact rAF tick the canvas reveals its new
        // bitmap. The DOM nodes themselves are reachable through these
        // refs so the swap is a direct attribute write — no React commit,
        // no diff, no extra frame.
        blurEl1: null,
        blurEl2: null,
        committedImage: null,        // src currently mounted on blurEl1/2
        // The inner div that holds the canvas + blur layers. We drive its
        // opacity imperatively in setImgd so the canvas can paint
        // (canvas.width/height/drawImage) while the inner div is held at
        // opacity 0, and the moment the bitmap is ready + the start
        // transform is committed, we flip to 1. This replaces the prior
        // double-rAF dance that left a window of visible pre-transition
        // state and ultimately ordered things wrong (start position not
        // guaranteed to paint before the transition class was added).
        innerEl: null,
        // Drag axis disambiguation for the bottom-drawer. We compare the
        // first ~10 px of pointer travel: if |dx| dominates we lock to
        // horizontal (let SwipeableViews handle it) and never start the
        // vertical drag this gesture. If |dy| dominates we commit to the
        // vertical drag/scroll path and never yield it back.
        cardAxisLocked: null,        // null | "v" | "h"

        // Watermark-download cache: the styled frame captured in setImgd so
        // the download reuses it instead of re-running the render pool.
        renderedImageData: null,
        renderedKey: null,

        // Hero fast-path preview: on a card→dialog open we snapshot the
        // clicked PaperCard's canvas (it already holds this artwork rendered
        // at card scale) and paint THAT for the hero flight, so the open
        // animation never waits on — or competes with — a fresh pool
        // render. previewBitmapPromise resolves to the snapshot ImageBitmap
        // (or null on failure), previewForId is the artwork it belongs to,
        // and pendingFullRender holds the deferred full-quality pass that
        // the hero-end timer flushes ONLY when the dialog needs a bigger
        // scale than the card had already computed.
        previewBitmapPromise: null,
        previewForId: null,
        pendingFullRender: null,
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * useImageGestures — handles wheel zoom, pointer drag, and pinch
 * on the artwork viewing area. All transforms are direct DOM mutation.
 * ══════════════════════════════════════════════════════════════════════ */
function useImageGestures(viewRef, imageRef, inst, stateRef, dispatch) {

    const applyTransform = useCallback(() => {
        // Reverse-hero flight owns the transform: wheel/drag/pinch (and the
        // same-artwork repaint path in setImgd) all funnel through here, so
        // this single guard keeps them from stomping the flying transition.
        if (inst.closingHero) return;
        const el = imageRef.current;
        if (!el || !el.style) return;
        el.style.transform =
            `translate3d(calc(${inst.posLeft}px - 50%), calc(${inst.posTop}px - 50%), 0) scale(${(inst.currentZoom / 3).toFixed(4)})`;
    }, []);

    const applyWheel = useCallback(() => {
        inst.rafWheelId = null;
        const e = inst.pendingWheelEvent;
        if (!e) return;
        inst.pendingWheelEvent = null;

        const m = inst.viewMeasurement;
        const s = stateRef.current._size;
        const current = inst.currentZoom;

        const deltaY = e.deltaY;
        let delta = Math.max(Math.min(0.125, Math.abs(deltaY * -0.01)), 0.25);
        delta = deltaY * -0.01 > 0 ? delta : -delta;

        const scaleRatio = Math.pow(current < 1 ? 1 / current : current, 1.6);
        const newScale = current + delta * current * (0.9 / scaleRatio);

        if (newScale > 5 || newScale < 0.2) return;

        const ccW = m.width, ccH = m.height;
        const cwW = s.width * current, cwH = s.height * current;

        let posX = e.pageX ? (e.pageX - m.left | 0) : (ccW / 2 | 0);
        let posY = e.pageY ? (e.pageY - m.top | 0) : (ccH / 2 | 0);

        const ratio = 1 - current / newScale;
        const ratio2 = newScale / current;

        let nmx = (inst.posLeft - posX * ratio) * ratio2 + (e.movementX || 0) | 0;
        let nmy = (inst.posTop - posY * ratio) * ratio2 + (e.movementY || 0) | 0;

        const fmx = (ccW - cwW) / 2 | 0, fmy = (ccH - cwH) / 2 | 0;
        nmx -= fmx; nmy -= fmy;
        const nmxR = Math.min(Math.abs(nmx), cwW + fmx) * (nmx < 0 ? -1 : 1) + fmx;
        const nmyR = Math.min(Math.abs(nmy), cwH + fmy) * (nmy < 0 ? -1 : 1) + fmy;

        inst.currentZoom = newScale;
        inst.posLeft = nmxR;
        inst.posTop = nmyR;
        applyTransform();
        dispatch({ zoom: newScale });
    }, []);

    const handleWheel = useCallback((e) => {
        inst.pendingWheelEvent = e;
        if (!inst.rafWheelId) inst.rafWheelId = requestAnimationFrame(applyWheel);
    }, []);

    // The on-screen rect of the image wrapper, computed instead of
    // measured. The wrapper is position:fixed with
    //   transform: translate3d(posLeft − 50%, posTop − 50%) scale(zoom/3)
    // about its own center, and its layout box is exactly the canvas CSS
    // box (_size * 2 — the blur backplates are absolutely positioned), so
    // the visual rect is pure arithmetic. getBoundingClientRect told us
    // nothing we didn't already know, and this runs on the pointer path,
    // where a forced layout hurts most. During a hero flight the
    // arithmetic rect is the LANDING rect (the transform target), not the
    // mid-flight interpolation — for the drag hit-test that's the more
    // useful answer anyway.
    const getImageRect = useCallback(() => {
        const s = stateRef.current._size;
        if (!s || !s.width) return null;
        const k = inst.currentZoom / 3;
        const w = s.width * 2 * k, h = s.height * 2 * k;
        return {
            left: inst.posLeft - w / 2, top: inst.posTop - h / 2,
            right: inst.posLeft + w / 2, bottom: inst.posTop + h / 2,
            width: w, height: h,
        };
    }, []);

    const applyDrag = useCallback(() => {
        inst.rafDragId = null;
        if (!inst.dragging) return;
        inst.posLeft = inst.dragOriginLeft + inst.pendingDx;
        inst.posTop = inst.dragOriginTop + inst.pendingDy;
        applyTransform();
    }, []);

    const handlePointerDown = useCallback((e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;

        if (inst.activePointers) {
            inst.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (inst.activePointers.size === 2) {
                const pts = [...inst.activePointers.values()];
                inst.pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
                inst.startZoom = inst.currentZoom;
                inst.twoPointer = true;
                inst.dragging = false;
                return;
            }
        } else {
            inst.activePointers = new Map();
            inst.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (inst.twoPointer) return;

        const rect = getImageRect();
        if (!rect) return;

        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
            inst.dragging = true;
            inst.dragStartX = e.clientX;
            inst.dragStartY = e.clientY;
            inst.dragOriginLeft = inst.posLeft;
            inst.dragOriginTop = inst.posTop;
            if (imageRef.current) imageRef.current.style.willChange = "transform";
        }
    }, []);

    const handlePointerMove = useCallback((e) => {
        if (inst.activePointers && inst.activePointers.has(e.pointerId)) {
            inst.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (inst.activePointers.size === 2 && inst.pinchStartDist) {
                const pts = [...inst.activePointers.values()];
                const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
                const zoom = Math.max(0.2, Math.min(inst.startZoom * (dist / inst.pinchStartDist), 5));
                inst.currentZoom = zoom;
                applyTransform();
                dispatch({ zoom });
                return;
            }
        }
        if (!inst.dragging || inst.twoPointer) return;
        inst.pendingDx = e.clientX - inst.dragStartX;
        inst.pendingDy = e.clientY - inst.dragStartY;
        if (!inst.rafDragId) inst.rafDragId = requestAnimationFrame(applyDrag);
    }, []);

    const handlePointerUp = useCallback((e) => {
        if (inst.activePointers) {
            inst.activePointers.delete(e.pointerId);
            if (inst.activePointers.size < 2) inst.pinchStartDist = null;
            if (inst.activePointers.size === 0) {
                inst.activePointers = null;
                if (inst.twoPointer) {
                    inst.twoPointerTimeout = setTimeout(() => {
                        inst.twoPointer = false;
                        inst.twoPointerTimeout = null;
                    }, 120);
                }
            }
        }
        if (inst.dragging) {
            inst.dragging = false;
            if (imageRef.current) imageRef.current.style.willChange = "auto";
        }
    }, []);

    // Attach / detach event listeners
    useEffect(() => {
        const el = viewRef.current;
        if (!el) return;
        const events = [
            ["wheel", handleWheel],
            ["pointerdown", handlePointerDown],
            ["pointermove", handlePointerMove],
            ["pointerup", handlePointerUp],
            ["pointercancel", handlePointerUp],
            ["pointerleave", handlePointerUp]
        ];
        events.forEach(([ev, fn]) => el.addEventListener(ev, fn, { passive: true }));
        return () => events.forEach(([ev, fn]) => el.removeEventListener(ev, fn, { passive: true }));
    }, [viewRef.current]);

    return { applyTransform, getImageRect };
}

/* ══════════════════════════════════════════════════════════════════════
 * useCardDrawer — handles mobile card drag, scroll, snap, momentum.
 * ══════════════════════════════════════════════════════════════════════ */
function useCardDrawer(cardRef, cardWrapperRef, inst, stateRef, dispatch) {

    const setCardContentScroll = useCallback((overflow) => {
        const cardEl = cardRef.current;
        if (!cardEl) return;
        const isDrag = overflow === "hidden";
        const scrollables = cardEl.querySelectorAll(
            '.MuiCardContent-root, .react-swipeable-view-container, .react-swipeable-view-container > div'
        );
        for (let i = 0; i < scrollables.length; i++) {
            scrollables[i].style.overflow = overflow;
            scrollables[i].style.touchAction = isDrag ? "none" : "";
            scrollables[i].style.pointerEvents = isDrag ? "none" : "";
        }
    }, []);

    const setupDragStyles = useCallback(() => {
        const w = cardWrapperRef.current;
        if (w) { w.style.willChange = "transform"; w.style.transition = "none"; w.style.overflow = "visible"; }
        setCardContentScroll("hidden");
    }, []);

    const findScrollableParent = useCallback((el) => {
        while (el && el !== cardRef.current) {
            if (el.classList && el.classList.contains("MuiCardContent-root")) return el;
            el = el.parentElement;
        }
        return null;
    }, []);

    const springBack = useCallback(() => {
        const DAMPING = 0.82, THRESH = 0.5;
        const w = cardWrapperRef.current;
        const isHidden = inst.cardIsHidden;
        const animate = () => {
            if (inst.cardDragging) return;
            inst.cardYOffset *= DAMPING;
            if (Math.abs(inst.cardYOffset) < THRESH) {
                inst.cardYOffset = 0;
                if (w) { w.style.transform = ""; w.style.willChange = ""; w.style.transition = ""; w.style.overflow = ""; }
                return;
            }
            if (w) {
                w.style.transform = isHidden
                    ? `translateY(calc(100% - 96px + ${inst.cardYOffset}px))`
                    : `translateY(${inst.cardYOffset}px)`;
            }
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, []);

    const applyScrollMomentum = useCallback(() => {
        const FRICTION = 0.95, THRESH = 0.5;
        const scrollable = inst.cardActiveScrollable;
        if (!scrollable) return;
        let velocity = inst.scrollVelocity;
        const tick = () => {
            if (inst.cardScrolling || inst.cardDragging) { inst.scrollMomentumRaf = null; return; }
            velocity *= FRICTION;
            if (Math.abs(velocity) < THRESH) { inst.scrollMomentumRaf = null; return; }
            scrollable.scrollTop -= velocity;
            if (scrollable.scrollTop <= 0 || scrollable.scrollTop >= scrollable.scrollHeight - scrollable.clientHeight) {
                inst.scrollMomentumRaf = null; return;
            }
            inst.scrollMomentumRaf = requestAnimationFrame(tick);
        };
        inst.scrollMomentumRaf = requestAnimationFrame(tick);
    }, []);

    const applyCardDrag = useCallback(() => {
        inst.rafCardId = null;
        if (!inst.cardDragging) return;
        inst.cardYOffset = inst.pendingCardOffset;
        const w = cardWrapperRef.current;
        if (!w) return;
        w.style.transform = inst.cardIsHidden
            ? `translateY(calc(100% - 96px + ${inst.cardYOffset}px))`
            : `translateY(${inst.cardYOffset}px)`;
    }, []);

    const handleDown = useCallback((e) => {
        if (!stateRef.current._view_right_mobile_enabled) return;
        if (inst.scrollMomentumRaf) { cancelAnimationFrame(inst.scrollMomentumRaf); inst.scrollMomentumRaf = null; }
        inst.cardYStart = e.pageY; inst.cardXStart = e.pageX;
        inst.cardYOffset = 0; inst.cardPointerId = e.pointerId;
        inst.cardIsHidden = !stateRef.current._view_mobile_opened;
        inst.lastPointerY = e.pageY; inst.scrollVelocity = 0;
        // Axis-lock starts unset. We wait until the first ~8 px of travel
        // to decide horizontal-vs-vertical, so a quick sideways swipe over
        // the drawer doesn't accidentally start a drag-down — SwipeableViews
        // needs that gesture for tab changes.
        inst.cardAxisLocked = null;
        try { cardRef.current.setPointerCapture(e.pointerId); } catch (_) {}
        if (!inst.cardIsHidden) {
            // Drawer open: defer the scrolling/dragging decision until
            // we know the gesture's axis. Pre-resolve the scrollable
            // target now (cheaper to do it once than on every move) but
            // do NOT enter cardScrolling yet — that would steal horizontal
            // swipes from SwipeableViews.
            inst.cardScrolling = false; inst.cardDragging = false;
            inst.cardActiveScrollable = findScrollableParent(e.target);
            return;
        }
        // Drawer closed: drag-to-open is unambiguously vertical, no axis
        // lock needed. Enter drag immediately so the bottom strip feels
        // responsive.
        inst.cardScrolling = false; inst.cardDragging = true; inst.cardActiveScrollable = null;
        inst.cardAxisLocked = "v";
        setupDragStyles();
    }, []);

    /* Threshold (px) before we commit to an axis. Smaller = faster response
     * but more false positives on near-diagonal gestures. 8 px tracks well
     * with native iOS/Android scroll-vs-swipe thresholds. */
    const AXIS_LOCK_THRESHOLD = 8;
    /* How much vertical motion (relative to horizontal) is needed to claim
     * the gesture as vertical. 1.0 is a 45° split; 1.2 biases slightly
     * toward horizontal so SwipeableViews wins close calls. */
    const VERTICAL_BIAS = 1.2;

    const handleMove = useCallback((e) => {
        // ── Axis-lock phase (drawer open, gesture not yet classified). ───
        // We need this BEFORE the cardScrolling/cardDragging branches so a
        // horizontal swipe never triggers either — it should pass straight
        // through to SwipeableViews.
        if (inst.cardAxisLocked === null) {
            const dY = e.pageY - inst.cardYStart;
            const dX = e.pageX - inst.cardXStart;
            const absX = Math.abs(dX), absY = Math.abs(dY);
            if (absX < AXIS_LOCK_THRESHOLD && absY < AXIS_LOCK_THRESHOLD) {
                // Not enough travel yet — let the gesture continue without
                // committing. Crucially we do NOT preventDefault here, so
                // SwipeableViews's own touch handler can still observe the
                // movement and start a horizontal swipe if it wants.
                return;
            }
            if (absY > absX * VERTICAL_BIAS) {
                // Vertical lock: commit to scroll/drag path.
                inst.cardAxisLocked = "v";
                // Re-baseline the start so the first scroll/drag tick uses
                // the post-threshold position as zero — avoids a sudden
                // jump of AXIS_LOCK_THRESHOLD px on first commit.
                inst.cardYStart = e.pageY;
                inst.cardXStart = e.pageX;
                inst.lastPointerY = e.pageY;
                const scrollable = inst.cardActiveScrollable;
                const atTop = !scrollable || scrollable.scrollTop <= 0;
                // If there's no scrollable under the pointer (user is on
                // the header/tabs/bottom bar) OR the scrollable is already
                // at top AND they're pulling down, go straight to drag.
                if ((!scrollable || atTop) && dY > 0) {
                    inst.cardScrolling = false; inst.cardDragging = true;
                    setupDragStyles();
                } else {
                    inst.cardScrolling = true; inst.cardDragging = false;
                }
            } else {
                // Horizontal lock: yield the whole gesture to SwipeableViews
                // by marking ourselves out. We don't capture, don't preventDefault,
                // don't move anything. The pointer-up handler will see this
                // state and do nothing too.
                inst.cardAxisLocked = "h";
                try { cardRef.current.releasePointerCapture(inst.cardPointerId); } catch (_) {}
                return;
            }
        }

        if (inst.cardAxisLocked === "h") return;

        if (inst.cardScrolling) {
            const incY = e.pageY - inst.lastPointerY;
            inst.lastPointerY = e.pageY;
            inst.scrollVelocity = 0.6 * incY + 0.4 * inst.scrollVelocity;
            const scrollable = inst.cardActiveScrollable;
            const atTop = !scrollable || scrollable.scrollTop <= 0;
            // Pull-down past top: switch to drag-down. We use a small extra
            // hysteresis (8 px past zero) so brief over-scrolls don't trip
            // the drag prematurely. The same threshold the old code used.
            if (atTop && incY > 0 && (e.pageY - inst.cardYStart) > 8) {
                inst.cardScrolling = false; inst.cardDragging = true;
                inst.cardYStart = e.pageY; setupDragStyles();
                e.preventDefault(); e.stopPropagation(); return;
            }
            e.preventDefault(); e.stopPropagation();
            if (scrollable) scrollable.scrollTop -= incY;
            return;
        }
        if (!inst.cardDragging) return;
        const dY = e.pageY - inst.cardYStart, dX = Math.abs(e.pageX - inst.cardXStart);
        if (Math.abs(dY) > 4) { e.preventDefault(); e.stopPropagation(); }
        inst.pendingCardOffset = inst.cardIsHidden ? Math.min(0, dY + dX) : Math.max(0, dY - dX);
        if (!inst.rafCardId) inst.rafCardId = requestAnimationFrame(applyCardDrag);
    }, []);

    const handleUp = useCallback((e) => {
        // Horizontal-lock or gesture that never crossed the axis threshold:
        // we never touched scroll/drag state, so there's nothing to undo.
        // Just reset the lock and let SwipeableViews (or a plain tap) own it.
        if (inst.cardAxisLocked !== "v") {
            inst.cardAxisLocked = null;
            try { cardRef.current.releasePointerCapture(inst.cardPointerId); } catch (_) {}
            return;
        }
        inst.cardAxisLocked = null;
        if (inst.cardScrolling) {
            inst.cardScrolling = false;
            try { cardRef.current.releasePointerCapture(inst.cardPointerId); } catch (_) {}
            applyScrollMomentum(); return;
        }
        if (!inst.cardDragging) return;
        inst.cardDragging = false;
        try { cardRef.current.releasePointerCapture(inst.cardPointerId); } catch (_) {}
        setCardContentScroll("");

        const offset = inst.cardYOffset, hidden = inst.cardIsHidden;
        const { hysteresisClosed, hysteresisOpened } = inst.drawerSettings;
        const shouldOpen = hidden && Math.abs(offset) > hysteresisClosed;
        const shouldClose = !hidden && Math.abs(offset) > hysteresisOpened;
        const w = cardWrapperRef.current;

        if (shouldOpen || shouldClose) {
            inst.cardYOffset = 0;
            if (w) { w.style.transition = ""; w.style.transform = ""; w.style.willChange = ""; w.style.overflow = ""; }
            if (shouldClose) {
                // Drag-to-close is a manual close — defer to the back-arrow
                // path so the URL stays in sync (same policy as the close
                // button / tap-overlay).
                HISTORY.back();
            } else {
                dispatch({ _view_mobile_opened: true });
            }
            setTimeout(() => { if (w) w.style.willChange = ""; }, 300);
        } else {
            springBack();
        }
    }, []);

    // Attach / detach event listeners
    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        const events = [
            ["pointerdown", handleDown],
            ["pointermove", handleMove],
            ["pointerup", handleUp],
            ["pointercancel", handleUp]
        ];
        events.forEach(([ev, fn]) => el.addEventListener(ev, fn, { passive: false, capture: true }));
        return () => events.forEach(([ev, fn]) => el.removeEventListener(ev, fn, { passive: false, capture: true }));
    }, [cardRef.current]);

    return { setCardContentScroll };
}

/* ══════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ══════════════════════════════════════════════════════════════════════ */
/* Set an uncontrolled MUI TextField's value imperatively (the comment bar
 * fields are uncontrolled by design — see submitComment). Dispatches an
 * `input` event so any listeners observe the change. */
function setTextFieldValue(id, val) {
    const tf = document.getElementById(id);
    if (!tf) return;
    const inp = tf.querySelector?.("input, textarea");
    if (inp) inp.value = val;
    else if (tf.value !== undefined) tf.value = val;
    try {
        const ev = new Event("input", { bubbles: true });
        (inp || tf).dispatchEvent(ev);
    } catch (_) {}
}

function PostDialog(props) {
    const { classes, keepMounted } = props;

    // ── Reducer: render-triggering state ──
    const [state, rawDispatch] = useReducer(patchReducer, INITIAL_STATE);
    const stateRef = useRef(null);
    if (!stateRef.current) stateRef.current = { ...INITIAL_STATE };
    // Sync stateRef on every render so reads after dispatch see fresh values
    // (the sync dispatch also patches it eagerly for same-tick reads)
    Object.assign(stateRef.current, state);

    /* Sync dispatch: mirrors the old setSt4te behavior.
     * Updates stateRef.current IMMEDIATELY so any code that runs after
     * dispatch() in the same synchronous tick sees fresh values.
     * rawDispatch() schedules the actual re-render asynchronously. */
    const dispatch = useCallback((patch) => {
        Object.assign(stateRef.current, patch);
        rawDispatch(patch);
    }, [rawDispatch]);

    // ── Instance vars (non-reactive) ──
    const instRef = useRef(null);
    if (!instRef.current) instRef.current = createInst();
    const inst = instRef.current;

    // ── DOM refs ──
    const viewRef = useRef(null);
    const imageRef = useRef(null);
    const canvasRef = useRef(null);
    const cardRef = useRef(null);
    const cardWrapperRef = useRef(null);

    // ── Custom hooks ──
    const { applyTransform, getImageRect } = useImageGestures(viewRef, imageRef, inst, stateRef, dispatch);
    useCardDrawer(cardRef, cardWrapperRef, inst, stateRef, dispatch);

    // ── Stable function refs (avoid stale closures) ──
    const fnRef = useRef({});

    /* ================================================================
     * CANVAS & RENDER PIPELINE
     * ================================================================ */
    const clearCanvas = useCallback(() => {
        const can = canvasRef.current;
        if (can) {
            can.width = 0; can.height = 0; can._cachedAR = null;
            can._previewFor = null; can._previewW = 0;
            // Re-arm the invisibility latch: a new artwork is incoming, so until
            // setImgd has finished painting at the new size the canvas must not
            // be visible — even though React will (re)write its CSS width/height
            // as `_size` updates ahead of the worker callback.
            can.style.visibility = "hidden";
        }
    }, []);

    /* ── Hero fast-path preview (card bitmap reuse) ─────────────────────
     * On a card→dialog open the clicked PaperCard's canvas already shows
     * this exact artwork, rendered with the SAME renderer/mode (both come
     * from settings) at card scale. Re-running the pool before the hero
     * can start is what made opens feel heavy: the WASM upscale (scale up
     * to 32) is by far the slowest link, and its output is thrown at a
     * 460 ms flight that ends where the card's pixels would have looked
     * fine. So: snapshot the card canvas at open time, fly THAT, and only
     * after the hero lands run the full-quality pass — and only when the
     * dialog actually needs a bigger scale than the card had.
     *
     * The card is located the same way the reverse-hero close finds it:
     * by the `data-artwork-id` stamp on the card canvas (see PaperCard /
     * getReturnRect in the host pages). Because the lookup lives here, the
     * host pages need no changes and Feed / FeedPersonal / Profile all get
     * the fast path for free.
     *
     * discardPreview also releases the snapshot's GPU memory when it was
     * never consumed (nav away, close, unmount). */
    const discardPreview = useCallback(() => {
        const p = inst.previewBitmapPromise;
        inst.previewBitmapPromise = null;
        inst.previewForId = null;
        inst.pendingFullRender = null;
        if (p) p.then((bmp) => { if (bmp) { try { bmp.close && bmp.close(); } catch (e) {} } }).catch(() => {});
    }, []);

    const capturePreview = useCallback((id) => {
        discardPreview();
        if (id == null || typeof document === "undefined" || typeof createImageBitmap !== "function") return;
        let el = null;
        try { el = document.querySelector(`canvas[data-artwork-id="${CSS.escape(String(id))}"]`); } catch (e) { return; }
        if (!el || !el.isConnected) return;
        // Only snapshot a canvas that has actually painted THIS artwork (the
        // card adds the literal 'revealed' class on first paint) and that is
        // not NSFW-blurred — the blur is CSS-only, so a snapshot of a blurred
        // card would fly its raw pixels across the screen.
        if (!el.classList.contains("revealed") || el.classList.contains("nsfw-blur")) return;
        inst.previewForId = "" + id;
        // Snapshot the card's CURRENT bitmap (works for both the
        // bitmaprenderer and the 2d-fallback card contexts). Resolves to
        // null on failure — renderPipeline then falls back to the normal
        // full render.
        inst.previewBitmapPromise = createImageBitmap(el).catch(() => null);
    }, [discardPreview]);

    /* Symmetric teardown for the blur backplate <img>s. Deliberately NOT
     * folded into clearCanvas: mid-life paths (nav prev/next, new-image
     * branch within an open dialog) call clearCanvas while we still want
     * the blur to keep showing the outgoing post through the dismiss/
     * bounce animation — the atomic swap in setImgd is what replaces it.
     * Only on a real close, where the dialog is fully gone, do we want
     * the blurs to actually clear so the next open starts from a blank
     * slate (and a clean fade-in from 0 opacity, see classes.blurFadeIn).
     * Clearing src on a still-rendered <img> would otherwise produce a
     * broken-image icon flash; here it's safe because the parent is
     * unmounted/invisible by the time we run. */
    const clearBlurImages = useCallback(() => {
        const fade = classes.blurFadeIn;
        if (inst.blurEl1) {
            inst.blurEl1.removeAttribute("src");
            if (fade) inst.blurEl1.classList.remove(fade);
            // Undo the reverse-hero's imperative fade-out (opacity 0 +
            // transition) so the next open starts from the stock styling
            // and blurFadeIn animates cleanly again.
            inst.blurEl1.style.opacity = "";
            inst.blurEl1.style.transition = "";
        }
        if (inst.blurEl2) {
            inst.blurEl2.removeAttribute("src");
            if (fade) inst.blurEl2.classList.remove(fade);
            inst.blurEl2.style.opacity = "";
            inst.blurEl2.style.transition = "";
        }
        if (inst.innerEl) inst.innerEl.style.opacity = "0";
    }, [classes]);

    const setImgd = useCallback((imgd, b, id, renderId, isPreview) => {
        const st = stateRef.current;
        if (id !== st.data.id || renderId !== inst.currentRenderId) return;

        const _size = st._size;
        const can = canvasRef.current;
        if (!can || !_size) return b.close();

        // ────────────────────────────────────────────────────────────────
        // ORDERING CONTRACT (no rAF in this function — see below for why):
        //   1. Resolve start/final positions (pure arithmetic — the view
        //      box and the origin rect are both known, nothing measures).
        //   2. Stage the outer-div transform at the START position.
        //   3. Size the canvas bitmap (width/height) — this also clears it.
        //   4. drawImage() into the now-correctly-sized bitmap.
        //   5. Update CSS width/height/aspectRatio to match the bitmap.
        //   6. Swap blur backplate src + take the fade-in class OFF
        //      (restart part 1 — it returns after step 8).
        //   7. Make the canvas + inner div visible (visibility:visible,
        //      inner div opacity: 1). At this point the user sees the new
        //      artwork at the start position, fully painted, instantly.
        //   8. Force ONE synchronous reflow (void offsetHeight). It
        //      commits the start transform for the FLIP AND the fade
        //      class removal in the same layout pass — this used to be
        //      three forced layouts (two offsetWidth reads + this one).
        //   9. Re-add the blur fade class (restart part 2), add the
        //      heroTransition class + set the final transform. Because
        //      step 8 committed the start state, the browser interpolates
        //      start → final via the transition. Animation begins NOW,
        //      with no rAF wait.
        //
        // Why no rAF? The previous design used a double rAF to "wait for
        // the start position to paint" — but the browser commits style/
        // transform changes to layout the moment we read a layout
        // property (offsetHeight). A forced reflow does the same job as
        // waiting a frame, except synchronously, so we can guarantee the
        // exact ordering above without yielding control. The double rAF
        // also caused user-visible artefacts: between the first and
        // second rAF, React was committing `dispatch({_hidden: false})`,
        // which could fire its own re-render BEFORE the second rAF set
        // the final transform — producing a visible "snap to start, then
        // animate" hiccup. With no rAFs, the entire pipeline is in one
        // synchronous task and the browser produces exactly one paint
        // with everything in the right state.
        // ────────────────────────────────────────────────────────────────

        // ── Step 1: resolve positions. ──────────────────────────────────
        const viewRect = inst.viewMeasurement;
        const finalLeft = viewRect.width / 2 | 0;
        const finalTop = viewRect.height / 2 | 0;
        const finalZoom = st.zoom || 1.33;
        const isHero = inst.heroAnimating && inst.originRect;
        let startLeft, startTop, startZoom;
        if (isHero) {
            const origin = inst.originRect;
            startZoom = (origin.width / (_size.width * 2)) * 3;
            startLeft = (origin.left + origin.width / 2) | 0;
            startTop = (origin.top + origin.height / 2) | 0;
        } else {
            startLeft = finalLeft;
            startTop = finalTop;
            startZoom = finalZoom;
        }

        // Same-artwork re-render path: caller is re-painting an already-
        // shown post (e.g. renderer changed, zoom committed). Skip the
        // open animation entirely — just paint and apply the existing
        // transform, no class swap, no opacity dance.
        const sameArtwork = inst.positionSetForId === id && !inst.heroAnimating;

        const el = imageRef.current;

        // ── Step 2: stage start transform on the outer div. ─────────────
        if (!sameArtwork && el) {
            inst.posLeft = startLeft;
            inst.posTop = startTop;
            inst.currentZoom = startZoom;
            el.classList.remove(classes.heroTransition);
            el.style.transform = `translate3d(calc(${startLeft}px - 50%), calc(${startTop}px - 50%), 0) scale(${(startZoom / 3).toFixed(4)})`;
        }

        // ── Step 3-5: size + paint canvas. ──────────────────────────────
        // Setting can.width/height clears the bitmap as a side effect.
        // We do this AFTER staging the transform so that on the next
        // browser paint, the canvas pixels and the outer-div position
        // become visible together.
        const targetW = _size.width * 3, targetH = _size.height * 3;
        const needsResize = can.width !== targetW || can.height !== targetH;
        const ar = `${imgd.width} / ${imgd.height}`;
        if (can._cachedAR !== ar) { can.style.aspectRatio = ar; can._cachedAR = ar; }
        if (needsResize) { can.width = targetW; can.height = targetH; }

        // ── Cache the styled frame for the watermark download. ──────────────
        // This is the only place the rendered pixels are reachable: the canvas
        // is a bitmaprenderer (no getImageData) and `b` is neutralized by the
        // transfer just below. Keyed by render params so we capture once per
        // artwork/renderer/size, not per frame. Prefer the pool's ImageData
        // when it carries pixels (copied, so a recycled pool buffer can't
        // mutate ours); otherwise read it back off the bitmap before transfer.
        // The hero fast-path preview is NOT the styled frame — it's the card's
        // lower-scale snapshot, and its first argument is the SOURCE ImageData
        // (aspect only). Capturing it here would poison the download cache
        // (and stall the hero start on a sync GPU readback), so skip: the
        // download path's cold-cache fallback re-runs the pool if needed.
        if (!isPreview) {
            const renderedKey = id + "|" + st.renderer + "|" + (st.mode || "") + "|" + b.width + "x" + b.height;
            if (inst.renderedKey !== renderedKey) {
                try {
                    if (imgd && imgd.data && imgd.data.length) {
                        inst.renderedImageData = new ImageData(new Uint8ClampedArray(imgd.data), imgd.width, imgd.height);
                    } else {
                        const cap = createCanvas(b.width, b.height);
                        cap.ctx.drawImage(b, 0, 0);
                        inst.renderedImageData = cap.ctx.getImageData(0, 0, b.width, b.height, { colorSpace: "srgb" });
                    }
                    inst.renderedKey = renderedKey;
                } catch (e) { inst.renderedImageData = null; inst.renderedKey = null; }
            }
        }

        // Mark what this paint is BEFORE the transfer neutralizes `b` (its
        // width reads 0 once detached). renderPipeline's mid-hero re-runs
        // (resize during the flight) read these to refresh the deferred
        // full-quality pass instead of launching a render against the hero.
        can._previewFor = isPreview ? id : null;
        can._previewW = isPreview ? b.width : 0;

        can.context.transferFromImageBitmap(b, 0, 0, targetW, targetH);
        b.close();
        const cssW = `${_size.width * 2}px`, cssH = `${_size.height * 2}px`;
        if (can.style.width !== cssW) can.style.width = cssW;
        if (can.style.height !== cssH) can.style.height = cssH;

        // ── Step 6: atomic blur swap + stage fade restart (part 1). ─────
        // The two blur <img>s are NOT driven by React diff (their src is
        // empty in the JSX). We flip them imperatively here so the blur
        // backplate and the canvas always show the SAME image on any
        // given paint. The fade-in class comes OFF here and goes back ON
        // after the single forced reflow at step 8 — this block used to
        // pay two extra forced layouts of its own (one offsetWidth read
        // per <img>) to restart the animation; now the FLIP's one flush
        // commits the class removal for free.
        const want = stateRef.current.data?.image || "";
        let fadeRestart = false;
        if (want && inst.committedImage !== want) {
            if (inst.blurEl1 && inst.blurEl1.getAttribute("src") !== want) inst.blurEl1.src = want;
            if (inst.blurEl2 && inst.blurEl2.getAttribute("src") !== want) inst.blurEl2.src = want;
            inst.committedImage = want;

            const fade = classes.blurFadeIn;
            if (fade) {
                if (inst.blurEl1) inst.blurEl1.classList.remove(fade);
                if (inst.blurEl2) inst.blurEl2.classList.remove(fade);
                fadeRestart = true;
            }
        }

        // ── Step 7: reveal — canvas visible, inner div opaque. ──────────
        // Per the ordering contract: canvas pixels are painted, sizes are
        // correct, blurs are swapped, outer-div transform is at start.
        // NOW we make it all visible at once. Opacity flips instantly
        // (no transition on the inline `style.opacity` property), which
        // is exactly the "before animation start opacity is 0, then
        // immediately 1" behaviour the design calls for. The 1600 ms
        // blurFadeIn keyframe on the blur <img>s runs in parallel.
        if (can.style.visibility !== "visible") can.style.visibility = "visible";
        if (inst.innerEl) inst.innerEl.style.opacity = "1";

        // Same-artwork re-render: we're done. Reconcile any state-driven
        // _hidden flag and bail.
        if (sameArtwork) {
            if (fadeRestart) {
                // Rare: same artwork, new image src (post edit). This path
                // skips the step-8 flush, so complete the restart locally.
                void (inst.blurEl1 || inst.blurEl2 || {}).offsetWidth;
                const fade = classes.blurFadeIn;
                if (inst.blurEl1) inst.blurEl1.classList.add(fade);
                if (inst.blurEl2) inst.blurEl2.classList.add(fade);
            }
            if (st._hidden) dispatch({ _hidden: false });
            else applyTransform();
            return;
        }

        // ── Step 8: ONE forced reflow. ──────────────────────────────────
        // Commits BOTH pending style facts in a single layout pass: the
        // start transform (so the transition rule at step 9 interpolates
        // from it — the standard FLIP commit) and the fade-in class
        // removal from step 6 (so re-adding it below restarts the
        // animation). This task used to force up to three layouts of the
        // freshly-mutated dialog tree; this is now the only one.
        if (el) void el.offsetHeight;
        else if (fadeRestart) void (inst.blurEl1 || inst.blurEl2 || {}).offsetWidth;

        // Fade restart, part 2: the flush committed the removal — the
        // class going back on retriggers the 1600 ms fade-in.
        if (fadeRestart) {
            const fade = classes.blurFadeIn;
            if (inst.blurEl1) inst.blurEl1.classList.add(fade);
            if (inst.blurEl2) inst.blurEl2.classList.add(fade);
        }

        // ── Step 9: kick the animation. ─────────────────────────────────
        // Hero branch: add transition rule, set final transform, start
        // 460 ms cleanup timer to drop the transition class.
        // Default branch: just snap to final (no transition class) and
        // commit positionSetForId so subsequent renders take the fast
        // path above.
        inst.posLeft = finalLeft; inst.posTop = finalTop;
        inst.currentZoom = finalZoom; inst.positionSetForId = id;

        if (isHero && el) {
            el.classList.add(classes.heroTransition);
            el.style.transform = `translate3d(calc(${finalLeft}px - 50%), calc(${finalTop}px - 50%), 0) scale(${(finalZoom / 3).toFixed(4)})`;
            dispatch({ _hidden: false, zoom: finalZoom });

            if (inst.heroTransitionTimer) clearTimeout(inst.heroTransitionTimer);
            inst.heroTransitionTimer = setTimeout(() => {
                inst.heroAnimating = false; inst.originRect = null; inst.drawerHasAppeared = true;
                if (el) el.classList.remove(classes.heroTransition);
                dispatch({ zoom: finalZoom });
                // Hero has landed. If the flight flew the card's snapshot and
                // the dialog needs a bigger scale than the card had, run the
                // deferred full-quality pass now — with heroAnimating cleared
                // and positionSetForId committed it takes setImgd's
                // same-artwork path: an in-place pixel swap, no re-animation.
                // A close that raced this timer drops the pass instead: the
                // fade-out (or reverse hero) must keep the pixels it has.
                const pending = inst.pendingFullRender;
                inst.pendingFullRender = null;
                if (pending && stateRef.current.open && !stateRef.current._closing && !inst.closingHero) pending();
            }, 460);
        } else {
            if (el) {
                el.style.transform = `translate3d(calc(${finalLeft}px - 50%), calc(${finalTop}px - 50%), 0) scale(${(finalZoom / 3).toFixed(4)})`;
            }
            dispatch({ _hidden: false });

            if (inst.navBouncing) {
                if (inst.navBounceTimer) clearTimeout(inst.navBounceTimer);
                inst.navBounceTimer = setTimeout(() => {
                    inst.navBouncing = false; inst.navTransitioning = false;
                    inst.navDirection = null; inst.drawerHasAppeared = true;
                    if (inst.navSafetyTimer) { clearTimeout(inst.navSafetyTimer); inst.navSafetyTimer = null; }
                    dispatch({});
                }, 650);
            } else {
                setTimeout(() => { inst.drawerHasAppeared = true; }, 600);
            }
        }
    }, [classes]);

    const renderPipeline = useCallback((renderer, imgd, size, mode) => {
        if (!imgd) return;
        const id = "" + stateRef.current.data.id;
        const renderId = inst.currentRenderId;
        const cb = (d, b) => setImgd(d, b, id, renderId);

        // Full-quality pool render at this renderer's dialog scale — the
        // pre-existing dispatch verbatim, hoisted so the hero fast path can
        // also queue it as the deferred pass that runs once the hero lands.
        const runFullRender = () => {
            if (renderId !== inst.currentRenderId) return; // artwork changed since queued
            if (renderer === "hexagon") {
                const scale = Math.max(Math.min(32, Math.ceil(size.width / imgd.width)), 3);
                hexF(imgd, scale, cb, true, id, mode);
            } else if (renderer === "xbrz") {
                const scale = Math.max(Math.min(32, Math.ceil(size.width / imgd.width) * 2), 6);
                xbrzF(imgd, scale, cb, true, id, mode);
            } else if (renderer === "crt") {
                const scale = Math.max(Math.min(32, Math.ceil(size.width / imgd.width) * 2), 6);
                crtF(imgd, scale, cb, true, id, mode);
            } else if (renderer === "tri") {
                const scale = Math.max(Math.min(32, Math.ceil(size.width / imgd.width) * 2), 6);
                triF(imgd, scale, cb, true, id, mode);
            } else {
                const scale = Math.max(Math.min(32, Math.ceil(size.width / imgd.width) * 2), 6);
                sqrF(imgd, scale, cb, true, id, mode);
            }
        };

        const heroInFlight = inst.heroAnimating && inst.originRect;

        // ── Hero fast path: fly the card's already-computed bitmap ──────
        // The snapshot was taken at open time (capturePreview). Paint it
        // immediately so the hero starts NOW instead of after a pool
        // render, then decide whether a sharper pass is needed at all:
        // the dialog's render formulas all target the canvas CSS box,
        // which is size.width * 2 CSS px wide. If the card's bitmap
        // already covers that, the needed scale is NOT bigger and the
        // pool never runs for this open.
        if (heroInFlight && inst.previewForId === id && inst.previewBitmapPromise) {
            const bmpP = inst.previewBitmapPromise;
            inst.previewBitmapPromise = null; inst.previewForId = null; // consume exactly once
            bmpP.then((bmp) => {
                if (!bmp || !bmp.width) { runFullRender(); return; } // snapshot failed → normal path
                if (renderId !== inst.currentRenderId || !inst.heroAnimating) {
                    // Stale: user navigated away, or metadata arrived so late
                    // the hero window is already over — render normally.
                    try { bmp.close && bmp.close(); } catch (e) {}
                    if (renderId === inst.currentRenderId) runFullRender();
                    return;
                }
                const pw = bmp.width;
                setImgd(imgd, bmp, id, renderId, true); // paints + kicks the hero
                inst.pendingFullRender = (size.width * 2 > pw) ? runFullRender : null;
            }).catch(() => { if (renderId === inst.currentRenderId) runFullRender(); });
            return;
        }

        // Mid-hero re-run while the preview is on screen (e.g. a window
        // resize inside the 460 ms flight): don't launch a pool render
        // against the animation — refresh the deferred pass with the new
        // size and let the hero-end flush run it (or drop it, if the new
        // size no longer needs more than the card had).
        if (heroInFlight && canvasRef.current && canvasRef.current._previewFor === id) {
            inst.pendingFullRender = (size.width * 2 > (canvasRef.current._previewW || 0)) ? runFullRender : null;
            return;
        }

        // ── Hero fast path, pool edition ────────────────────────────────
        // No live card snapshot to fly (card virtualized away, reopen
        // after close, deep scroll, NSFW-blurred at capture time) — but
        // the pool's render cache often still holds this artwork from its
        // card or a previous dialog visit. Fly the LARGEST cached render
        // (a cheap master-bitmap clone, not a decode + upscale) so the
        // flight starts now, and defer the sharper pass to the hero-end
        // flush exactly like the card-snapshot path — skipping it
        // entirely when the cached render already covers the dialog's
        // CSS box. A total miss falls through to the normal render.
        if (heroInFlight) {
            const poolAlgo =
                renderer === "hexagon" ? "hex" :
                    renderer === "xbrz" ? "xbrz" :
                        renderer === "crt" ? "crt" :
                            renderer === "tri" ? "tri" : "sqr";
            const acq = acquireBestCachedBitmap(id, poolAlgo);
            if (acq) {
                acq.then(({ bitmap }) => {
                    if (!bitmap || !bitmap.width) { runFullRender(); return; }
                    if (renderId !== inst.currentRenderId || !inst.heroAnimating) {
                        // Stale: navigated away, or the hero window closed
                        // while the clone resolved — render normally.
                        try { bitmap.close && bitmap.close(); } catch (e) {}
                        if (renderId === inst.currentRenderId) runFullRender();
                        return;
                    }
                    const pw = bitmap.width;
                    setImgd(imgd, bitmap, id, renderId, true); // paints + kicks the hero
                    inst.pendingFullRender = (size.width * 2 > pw) ? runFullRender : null;
                }).catch(() => { if (renderId === inst.currentRenderId) runFullRender(); });
                return;
            }
        }

        // An immediate render always supersedes a queued deferred pass —
        // never let both run for the same artwork.
        inst.pendingFullRender = null;
        runFullRender();
    }, [setImgd]);

    const computeSize = useCallback(() => {
        const st = stateRef.current;

        // ── Arithmetic view box — no layout read. ───────────────────────
        // This used to getBoundingClientRect() the viewLeft container, and
        // it runs at the worst possible moment: right after the metadata
        // dispatch committed a big React update, so the read forced a
        // synchronous layout of the entire freshly-mutated dialog tree
        // before the hero's first frame could exist. But the box is fully
        // determined by our own chrome: the Backdrop is fixed fullscreen,
        // STYLE_ROOT_CONTAINER fills it, and viewLeft is its first flex
        // child — anchored at the viewport origin, full height, full width
        // minus the DRAWER_WIDTH drawer on desktop (the mobile drawer is a
        // fixed bottom sheet, out of flow). window.innerWidth/innerHeight
        // are viewport metrics, not layout metrics — reading them never
        // triggers reflow. (The app frame never shows a body scrollbar —
        // feeds scroll inside the masonry container — so innerWidth needs
        // no scrollbar correction.)
        const vw = window.innerWidth || document.documentElement.clientWidth || 960;
        const vh = window.innerHeight || document.documentElement.clientHeight || 640;
        const mobile = vw <= MOBILE_BREAKPOINT;
        const m = {
            left: 0, top: 0,
            width: mobile ? vw : vw - DRAWER_WIDTH,
            height: vh,
        };
        inst.viewMeasurement = m;

        if (!st.metadata?.width) {
            if (st._view_right_mobile_enabled !== mobile) dispatch({ _view_right_mobile_enabled: mobile });
            return;
        }

        const md = st.metadata;
        const zMax = Math.min((m.width - 16) / md.width, (m.height - 16) / md.height);
        const size = { width: md.width * zMax | 0, height: md.height * zMax | 0 };
        const patch = { _size: size };
        if (st._view_right_mobile_enabled !== mobile) patch._view_right_mobile_enabled = mobile;
        dispatch(patch);

        renderPipeline(st.renderer, md.imgd, size, st.mode);
    }, [renderPipeline]);

    const debouncedComputeSize = useCallback(() => {
        if (!inst.resizeRaf) {
            inst.resizeRaf = requestAnimationFrame(() => { inst.resizeRaf = null; computeSize(); });
        }
    }, [computeSize]);

    /* ================================================================
     * COMMENTS API
     * ================================================================ */
    const fetchRepliesFor = useCallback((author, permlink, silent) => {
        const st = stateRef.current;
        const api = props.api;
        if (!api) return;
        if (!silent) dispatch({ _comments_loading: true });

        api.content.getContentReplies(author, permlink)
            .then((replies) => {
                if (!replies || !Array.isArray(replies) || replies.length === 0) {
                    const surviving = (stateRef.current._comments || [])
                        .filter(c => c._optimistic && c.parent_author === author && c.parent_permlink === permlink);
                    dispatch({ _comments: surviving, _comments_loading: false });
                    return;
                }
                const uniqueAuthors = [...new Set(replies.map(r => r.author).filter(Boolean))];
                const accsP = (uniqueAuthors.length > 0 && api.accounts)
                    ? api.accounts.getAccounts(uniqueAuthors).catch(() => []) : Promise.resolve([]);

                accsP.then((accounts) => {
                    const comments = buildReplyComments(replies, accounts, stateRef.current._authors);
                    const chainPermlinks = new Set(comments.map(c => c.permlink));
                    const surviving = (stateRef.current._comments || [])
                        .filter(c => c._optimistic && !chainPermlinks.has(c.permlink) && c.parent_author === author && c.parent_permlink === permlink);
                    dispatch({ _comments: surviving.concat(comments), _comments_loading: false });
                });
            })
            .catch(() => dispatch({ _comments_loading: false }));
    }, [props.api]);

    const fetchComments = useCallback(() => {
        const st = stateRef.current;
        // Nothing to discuss on a post that isn't there: the host page opens
        // this dialog with a URL stub before its fetch resolves, and deleted
        // posts never show their thread. Skip the round-trip in both cases.
        if (getPostState(st.data) !== POST_STATE.READY) return;
        const author = (st.data.author || {}).username;
        const permlink = st.data.permlink;
        if (author && permlink) fetchRepliesFor(author, permlink);
    }, [fetchRepliesFor]);

    // Lazy loader handed to CommentInList so each top-level comment can render
    // its own direct replies inline (the 2nd visible level). Returns the mapped
    // comments rather than dispatching them into _comments.
    const loadRepliesFor = useCallback((comment) => {
        const api = props.api;
        if (!api || !api.content || !comment) return Promise.resolve([]);
        const author = comment.username || (comment.author || {}).username;
        const permlink = comment.permlink;
        if (!author || !permlink) return Promise.resolve([]);

        return api.content.getContentReplies(author, permlink)
            .then((replies) => {
                if (!Array.isArray(replies) || replies.length === 0) return [];
                const localAuthors = stateRef.current._authors || {};
                const uniqueAuthors = [...new Set(replies.map(r => r.author).filter(Boolean))]
                    .filter(u => !localAuthors[u]);
                const accsP = (uniqueAuthors.length > 0 && api.accounts)
                    ? api.accounts.getAccounts(uniqueAuthors).catch(() => []) : Promise.resolve([]);
                return accsP.then((accounts) => buildReplyComments(replies, accounts, localAuthors));
            })
            .catch(() => []);
    }, [props.api]);

    const cacheOwnProfile = useCallback(() => {
        const api = props.api, account = props.account;
        const st = stateRef.current;
        if (!api || !account) return;
        if ((st._authors || {})[account] || (st._accounts || {})[account]) return;
        api.accounts.getAccounts([account]).then((accs) => {
            if (!accs || !accs.length) return;
            const acc = accs[0]; const u = acc.name || acc.account || account;
            let img = "", name = u;
            try { const m = typeof acc.posting_json_metadata === "string" ? JSON.parse(acc.posting_json_metadata) : (acc.posting_json_metadata || {}); const p = m.profile || {}; img = p.profile_image || p.image || ""; name = p.name || u; }
            catch(e) { try { const m2 = typeof acc.json_metadata === "string" ? JSON.parse(acc.json_metadata) : (acc.json_metadata || {}); const p2 = m2.profile || {}; img = p2.profile_image || p2.image || ""; name = p2.name || u; } catch(e2) {} }
            const cached = { ...stateRef.current._accounts }; cached[u] = { username: u, name, image: img };
            dispatch({ _accounts: cached });
        }).catch(() => {});
    }, [props.api, props.account]);

    const startCommentRefresh = useCallback(() => {
        if (inst.commentRefreshTimer) { clearInterval(inst.commentRefreshTimer); inst.commentRefreshTimer = null; }
        let attempts = 0;
        inst.commentRefreshTimer = setInterval(() => {
            attempts++;
            const st = stateRef.current;
            const cc = st._current_comments;
            if (cc && cc.length > 0) {
                const p = cc[cc.length - 1];
                const a = p.username || (p.author || {}).username, pl = p.permlink;
                if (a && pl) fetchRepliesFor(a, pl, true);
            } else {
                const a2 = (st.data.author || {}).username, pl2 = st.data.permlink;
                if (a2 && pl2) fetchRepliesFor(a2, pl2, true);
            }
            if (attempts >= 6) { clearInterval(inst.commentRefreshTimer); inst.commentRefreshTimer = null; }
        }, 3000);
    }, [fetchRepliesFor]);

    /* ================================================================
     * HANDLERS
     * ================================================================ */
    const handleTabChange = useCallback((e, value) => {
        dispatch({ _tab_value: value });
        if (inst.swipeableScrollTarget && inst.swipeableScrollTarget.isConnected) {
            inst.swipeableScrollTarget.style.scrollBehavior = "smooth";
            inst.swipeableScrollTarget.scrollTop = 0;
        }
    }, []);

    const handleArrowNav = useCallback((direction) => {
        if (inst.navTransitioning || inst.closingHero) return;
        /* No callback = no sibling in that direction (the host page computes
         * availability with the same blur-skipping walk navigation uses and
         * hands `undefined` when a direction is exhausted — same convention
         * as the orphan case). The arrow isn't rendered then either, but
         * guard here too so a stale click can't start the dismiss
         * choreography against a navigation that can never happen. */
        if (direction === "next" && !props.onNext) return;
        if (direction === "prev" && !props.onPrevious) return;
        inst.navTransitioning = true; inst.navDismissing = true; inst.navDirection = direction;
        dispatch({});
        inst.navDismissTimer = setTimeout(() => {
            inst.navDismissing = false; inst.navBouncing = true;
            /* Hide the image BEFORE calling the parent callback so that the
             * intermediate render (new props, old state) sees _hidden=true and
             * skips the bounceAppear class.  Without this, bounceAppear fires
             * once here and once when the new canvas is ready — a double anim. */
            dispatch({ _hidden: true });

            /* WIPE THE CANVAS BITMAP BEFORE PROPS CHANGE — synchronous, in the
             * same task as the parent-callback invocation. We MUST clear the
             * bitmap and hide the canvas here, not in a post-commit effect,
             * because the worker pipeline that paints the NEW artwork can take
             * anywhere from 30 to 100+ ms (getMetadata + scale + render). If
             * we waited for `useLayoutEffect` (post-commit) or `useEffect`
             * (post-paint) to wipe, then any frame the browser composites
             * between the dispatch above and the worker callback would carry
             * the previous artwork's pixels on the canvas bitmap — visible
             * during the bounceAppear class's opacity ramp from 0 → 1 (which
             * is exactly the ~50ms window the user perceived as "old image
             * flashes before new image appears"). Bumping `currentRenderId`
             * here too cancels any in-flight worker callback that might still
             * fire for the outgoing artwork with the new `_size`. */
            inst.currentRenderId++;
            const can = canvasRef.current;
            if (can) {
                can.width = 0; can.height = 0; can._cachedAR = null;
                can._previewFor = null; can._previewW = 0;
                can.style.visibility = "hidden";
            }
            inst.positionSetForId = null;
            inst.pendingFullRender = null;

            let navigated;
            if (direction === "next") navigated = props.onNext ? props.onNext() : false;
            else navigated = props.onPrevious ? props.onPrevious() : false;

            /* The host page returns `false` when its blur-skipping walk found
             * no target — every remaining sibling in that direction got
             * blurred between the availability check and this click (the
             * on-device NSFW verdicts land asynchronously). The dismissal
             * above already hid + wiped the canvas, so bounce the SAME
             * artwork straight back (navBouncing is already set — the
             * pipeline's bounce branch restores flags and pixels) instead of
             * leaving the 3 s safety net to do it. `undefined` — a host that
             * doesn't report a status — keeps the legacy behaviour.  */
            if (navigated === false) {
                inst.navDismissing = false;
                inst.positionSetForId = null;
                computeSize();
            }

            /* SAFETY NET: if the render pipeline fails to complete (missing
             * image, getMetadata error, worker bail-out), navTransitioning
             * stays locked forever.  Force-reset after a generous timeout. */
            if (inst.navSafetyTimer) clearTimeout(inst.navSafetyTimer);
            inst.navSafetyTimer = setTimeout(() => {
                if (inst.navTransitioning) {
                    inst.navTransitioning = false;
                    inst.navBouncing = false;
                    inst.navDismissing = false;
                    inst.navDirection = null;
                    /* The dismissal wiped the canvas bitmap; if the reset is
                     * firing because navigation never delivered a new post,
                     * nothing else will repaint it. Re-kick the pipeline for
                     * the still-current post so the reset restores pixels,
                     * not just flags. */
                    inst.positionSetForId = null;
                    computeSize();
                    dispatch({ _hidden: false });
                }
            }, 3000);
        }, 220);
    }, [props.onNext, props.onPrevious, computeSize]);

    const handleArrowPrev = useCallback(() => handleArrowNav("prev"), [handleArrowNav]);
    const handleArrowNext = useCallback(() => handleArrowNav("next"), [handleArrowNav]);

    const onRequestClose = useCallback(() => {
        const st = stateRef.current;
        if (inst.closingHero) return; // already flying home — ignore re-clicks
        if (st._view_mobile_opened && st._view_right_mobile_enabled) {
            // Manual drawer close on mobile — mirror what the browser back
            // arrow would do, so manual-close and back behave identically.
            // The HISTORY listener will pick up the URL change and dispatch
            // `_view_mobile_opened: false`.
            HISTORY.back();
            return;
        }

        /* ── Reverse hero ────────────────────────────────────────────────
         * Sibling navigation keeps the masonry scrolled to the current
         * artwork, so when the post is present in the grid its card sits
         * at (or near) the viewport behind the backdrop. Ask the host
         * page for that card's live rect and, if it has one, fly the
         * artwork back onto it — the exact inverse of the open hero:
         * same transform mapping, same transition class. Everything else
         * (backdrop tint, drawer, arrows) fades away via `_closing` →
         * classes.closingChrome, and props.onClose only fires once the
         * artwork has landed, so the Backdrop's own fade-out then
         * dissolves the landed image into the identical card pixels
         * beneath it. No rect (orphan post, card virtualized away or
         * off-viewport, artwork not painted yet, nav in flight) → the
         * plain fade-out close, exactly as before. */
        const el = imageRef.current;
        const _size = st._size;
        const canFly =
            el && _size && _size.width > 0 &&
            !st._hidden && inst.positionSetForId != null &&
            !inst.navTransitioning && typeof props.getReturnRect === "function";
        const rect = canFly ? props.getReturnRect() : null;

        if (rect && rect.width > 0 && rect.height > 0) {
            inst.closingHero = true;
            // An open-hero still in flight would strip the transition class
            // from under us when its 460 ms timer fires — take over cleanly.
            // Its deferred full-quality pass dies with it: nothing may swap
            // the canvas pixels mid-flight, and the card the artwork lands
            // on shows the very bitmap the preview flew in with.
            if (inst.heroTransitionTimer) { clearTimeout(inst.heroTransitionTimer); inst.heroTransitionTimer = null; }
            inst.heroAnimating = false; inst.originRect = null;
            inst.pendingFullRender = null;

            // Target transform: inverse of the open hero's start mapping —
            // scale the (_size.width * 2)-wide canvas down onto the card
            // rect and center on it.
            const endZoom = (rect.width / (_size.width * 2)) * 3;
            const endLeft = (rect.left + rect.width / 2) | 0;
            const endTop = (rect.top + rect.height / 2) | 0;

            // Fade the blur backplates out of the flight: the card has no
            // halo, so only the crisp canvas should land on it. Classes
            // come off here; the ONE flush below commits both that and
            // the current transform (this block used to pay one forced
            // layout per <img> plus the offsetHeight — three in total).
            const fade = classes.blurFadeIn;
            if (fade) {
                if (inst.blurEl1) inst.blurEl1.classList.remove(fade);
                if (inst.blurEl2) inst.blurEl2.classList.remove(fade);
            }

            // Store the landing values BEFORE dispatching `_closing`: the
            // re-render rewrites the outer div's inline transform from
            // inst.posLeft/posTop/currentZoom, and writing the same string
            // the transition is already heading to leaves it undisturbed.
            inst.posLeft = endLeft; inst.posTop = endTop; inst.currentZoom = endZoom;

            el.classList.add(classes.heroTransition);
            // ONE flush: commits the current transform as the transition's
            // start value AND the fade-class removals above.
            void el.offsetHeight;
            [inst.blurEl1, inst.blurEl2].forEach((b) => {
                if (!b) return;
                b.style.transition = "opacity 220ms cubic-bezier(0.4, 0, 0.2, 1)";
                b.style.opacity = "0";
            });
            el.style.transform = `translate3d(calc(${endLeft}px - 50%), calc(${endTop}px - 50%), 0) scale(${(endZoom / 3).toFixed(4)})`;
            dispatch({ _closing: true });

            if (inst.closingHeroTimer) clearTimeout(inst.closingHeroTimer);
            inst.closingHeroTimer = setTimeout(() => {
                inst.closingHeroTimer = null;
                inst.closingHero = false;
                const elNow = imageRef.current;
                if (elNow) elNow.classList.remove(classes.heroTransition);
                props.onClose?.();
            }, 440);
            return;
        }

        props.onClose?.();
    }, [props.onClose, props.getReturnRect, classes]);

    const openAuthor = useCallback((username) => {
        // Refuse to navigate when username is missing or empty — this avoids
        // pushing the broken `/@` URL (which doesn't match any PAGE_ROUTES
        // regex and would strand the user on a route that no page can parse
        // back into a username). Empty usernames can sneak in from a few
        // sources: a comment whose author wasn't in the fetched author map,
        // a vote profile entry rendered before its account was resolved, or
        // a not-yet-hydrated dialog data shape where `data.author.username`
        // is briefly missing.
        if (!username) return;
        HISTORY.push("/@" + username);
    }, []);

    const openAuthorFromData = useCallback(() => {
        openAuthor((stateRef.current.data.author || {}).username);
    }, [openAuthor]);

    const menuToggle = useCallback(() => {
        const st = stateRef.current;
        if (st._view_mobile_opened || !st._view_right_mobile_enabled) {
            if (st._view_right_mobile_enabled) {
                // Mobile manual close — defer to the back-arrow path. The
                // HISTORY listener will dispatch `_view_mobile_opened: false`.
                HISTORY.back();
            } else {
                props.onClose?.();
            }
        } else {
            // Mobile: open the drawer. The state→URL effect picks this up
            // and pushes the hash (closed→open transition).
            dispatch({ _view_mobile_opened: true });
        }
    }, [props.onClose]);

    const handleTagClick = useCallback((tag) => {
        HISTORY.push("/trending/" + tag); props.onClose?.();
    }, [props.onClose]);

    const handleCopy = useCallback((s) => {
        clipboard.writeText(s);
        dispatch({ _copied: true });
        actions.trigger_snackbar(t("components.post_dialog.the_url_has_been_copied"));
        setTimeout(() => { try { dispatch({ _copied: false }); } catch(e) {} }, 5000);
    }, []);

    const handleDownloadArtwork = useCallback(() => {
        const st = stateRef.current;
        let a = document.createElement("a");
        a.href = st.data.image; a.download = st.data.title + "." + st.type;
        a.style.display = "hidden"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }, []);

    const downloadWithWatermark = useCallback(() => {
        const st = stateRef.current;
        if (st._download_loading) return;
        const src = st.metadata?.imgd;
        if (!src) { actions.trigger_snackbar(t("components.post_dialog.image_not_ready_yet")); return; }
        dispatch({ _download_loading: true });

        JSLoader(() => import("../utils/watermark")).then((mod) => {
            const finish = (err) => {
                if (err) console.warn("[PostDialog] watermark download failed:", err?.message || err);
                dispatch({ _download_loading: false });
                if (err) actions.trigger_snackbar(t("components.post_dialog.download_failed"));
            };

            // Stamp the already-styled ImageData with the wordmark + license,
            // then hand the encoded result to the tap-to-save overlay (we do
            // NOT auto-click an <a> here: by the time the async encode resolves
            // the original click's transient activation is gone and the browser
            // cancels a programmatic download — the overlay turns the result
            // back into a genuine user gesture). Shared by the cache-hit path
            // and the cold-cache pool fallback so the watermark/encode logic
            // lives in exactly one place.
            const stampAndSave = (rendered) => {
                try {
                    let imgd = rendered;
                    if (!imgd || !imgd.data || !imgd.data.length) { finish(new Error("empty render result")); return; }

                    if (st.renderer === "hexagon") {
                        const orig = st.metadata?.imgd;
                        const ratio = orig.width / orig.height;
                        const w2 = imgd.width, h2 = Math.ceil(imgd.width / ratio);
                        const cnvs = createCanvas(imgd.width, imgd.height);
                        const cnvs2 = createCanvas(w2, h2);
                        cnvs.ctx.putImageData(imgd, 0, 0);
                        cnvs2.ctx.drawImage(cnvs, 0, 0, cnvs.width, cnvs.height, 0, 0, cnvs2.width, cnvs2.height);
                        imgd = cnvs2.ctx.getImageData(0, 0, cnvs2.width, cnvs2.height, { colorSpace: "srgb" });
                    }

                    const author = st.data.author?.username || "unknown";
                    const year = new Date(st.data?.date || Date.now()).getFullYear();
                    const fmt = st.format || "png";
                    mod.default(imgd, "@" + author, year, fmt.toUpperCase()).then((b64) => {
                        const filename = "Artwork_From_@" + author + "_Printed_Using_" + (st.renderer || "square").toUpperCase() + "." + fmt.toLowerCase();
                        dispatch({ _download_loading: false, _download_ready: { href: b64, filename } });
                    }).catch(finish);
                } catch (e) { finish(e); }
            };

            // Fast path: reuse the styled frame the display pipeline already
            // produced (captured in setImgd). No second pool render.
            if (inst.renderedImageData) { stampAndSave(inst.renderedImageData); return; }

            // Cold cache (download fired before the first paint committed, or
            // right after a close-reset): re-run the pool once and normalize the
            // result to a real ImageData via the bitmap (the pool's first arg may
            // be a detached/empty buffer — on screen we only read its w/h).
            const toImageData = (d, b) => {
                if (b && typeof ImageBitmap !== "undefined" && b instanceof ImageBitmap) {
                    const c = createCanvas(b.width, b.height);
                    c.ctx.drawImage(b, 0, 0);
                    return c.ctx.getImageData(0, 0, b.width, b.height, { colorSpace: "srgb" });
                }
                return (d && d.data && d.data.length) ? d : null;
            };
            let done = false;
            const onRendered = (d, b) => { if (done) return; done = true; stampAndSave(toImageData(d, b)); };
            const id = "" + st.data.id;
            const sized = (mult, min) => Math.max(Math.min(32, Math.ceil((st._size?.width || 0) / (st.metadata?.width || 1)) * mult), min);
            if (st.renderer === "hexagon") hexF(src, sized(2, 3), onRendered, true, id, st.mode);
            else if (st.renderer === "xbrz") { const s = sized(4, 2), target = src.width * s; xbrzF(src, s, (d, b) => { if (!d || target - 128 < (d.width || b?.width || 0)) onRendered(d, b); }, true, id, st.mode); }
            else if (st.renderer === "crt") crtF(src, sized(4, 2), onRendered, true, id, st.mode);
            else if (st.renderer === "tri") triF(src, sized(4, 2), onRendered, true, id, st.mode);
            else sqrF(src, sized(4, 2), onRendered, true, id, st.mode);
        }).catch((err) => { console.warn("[PostDialog] watermark module load failed:", err?.message || err); dispatch({ _download_loading: false }); actions.trigger_snackbar(t("components.post_dialog.download_failed")); });
    }, []);

    // Tap-to-save overlay actions. confirmDownload runs inside the overlay's
    // click handler, so it executes with fresh transient activation and the
    // browser allows the programmatic download. cancelDownload just dismisses.
    const confirmDownload = useCallback(() => {
        const payload = stateRef.current._download_ready;
        if (!payload) return;
        const a = document.createElement("a");
        a.href = payload.href;
        a.download = payload.filename;
        a.style.display = "none";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        dispatch({ _download_ready: null });
    }, []);

    const cancelDownload = useCallback(() => { dispatch({ _download_ready: null }); }, []);

    const handleSortingChange = useCallback((e) => { dispatch({ _sorting: e.target.value.toString() }); }, []);
    const toggleShowParent = useCallback(() => { dispatch({ _show_parent: !stateRef.current._show_parent }); }, []);

    const showReplies = useCallback((comment, ancestors) => {
        // `ancestors` are inline-shown parents not yet in the breadcrumb (a nested
        // reply's depth-0 parent), so the path stays complete when drilling in.
        const anc = Array.isArray(ancestors) ? ancestors : [];
        const cc = stateRef.current._current_comments.concat(...anc, comment);
        dispatch({ _current_comments: cc });
        const a = comment.username || (comment.author || {}).username, p = comment.permlink;
        if (a && p) fetchRepliesFor(a, p);
    }, [fetchRepliesFor]);

    const sliceReplies = useCallback((n) => {
        const cc = stateRef.current._current_comments.slice(0, n);
        dispatch({ _current_comments: cc });
        if (n === 0) fetchComments();
        else { const p = cc[cc.length - 1]; const a = p.username || (p.author || {}).username, pl = p.permlink; if (a && pl) fetchRepliesFor(a, pl); }
    }, [fetchComments, fetchRepliesFor]);

    const handleOpenLicenseDialog = useCallback(() => {
        const st = stateRef.current;
        const author = st.data.author || {};
        let meta = {};
        try { meta = typeof st.data.json_metadata === 'string' ? JSON.parse(st.data.json_metadata) : (st.data.json_metadata || {}); } catch (e) {}
        const license = meta.license || {};
        const hr = license.rightsConfiguration?.holderRights || {};
        const vr = license.rightsConfiguration?.visitorRights || {};
        dispatch({
            _license_dialog_opened: true,
            _license_customization: {
                isCustomized: license.isCustomized ?? true, customizedDate: new Date().toISOString(),
                authorInfo: { username: author.username || 'unknown', name: author.name || 'Unknown Artist', url: `https://pixagram.com/@${author.username || 'unknown'}` },
                artworkInfo: { title: st.data.title || `Artwork #${st.data.id}`, creationDate: st.data.created || st.data.date || new Date().toISOString(), nftContract: st.data.nftContract || st.data.contractAddress },
                rightsConfiguration: {
                    holderRights: { "personal-display": hr["personal-display"] ?? true, "commercial-use": hr["commercial-use"] ?? false, "social-media": hr["social-media"] ?? false, "physical-goods": hr["physical-goods"] ?? false, "third-party-licensing": hr["third-party-licensing"] ?? false, "modify": hr["modify"] ?? false, "derivatives": hr["derivatives"] ?? false, "mint-new-nfts": hr["mint-new-nfts"] ?? false, "metaverse": hr["metaverse"] ?? false, "games-apps": hr["games-apps"] ?? false, "music-video-film": hr["music-video-film"] ?? false, "exhibitions": hr["exhibitions"] ?? false, "educational": hr["educational"] ?? false, "ai-training": hr["ai-training"] ?? false },
                    visitorRights: { "share-with-attribution": vr["share-with-attribution"] ?? true, "share-without-attribution": vr["share-without-attribution"] ?? false, "modify-and-share": vr["modify-and-share"] ?? false, "ai-training": vr["ai-training"] ?? false }
                },
                royaltyPercentage: license.royaltyPercentage ?? 10,
                governingLaw: { jurisdiction: license.governingLaw?.jurisdiction || "", court: license.governingLaw?.court || "", arbitrationLocation: license.governingLaw?.arbitrationLocation || "", arbitrationRules: license.governingLaw?.arbitrationRules || "" }
            }
        });
    }, []);

    const closeLicenseDialog = useCallback(() => { dispatch({ _license_dialog_opened: false }); }, []);
    const clearReplyTarget = useCallback(() => { dispatch({ _reply_target: null }); }, []);
    const handleChangeIndex = useCallback((v) => handleTabChange({}, v), [handleTabChange]);

    /* PERF: Stable callback for comment TextField — avoids new inline arrow fn per render */
    const onCommentKeyDown = useCallback((e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); }
    }, [submitComment]);

    // Vote helpers
    const resolveInitialVoted = useCallback((data, account) => {
        if (!account || !data || !Array.isArray(data.active_votes)) return 0;
        const v = data.active_votes.find(v => v && v.voter === account);
        if (!v) return 0; return v.weight < 0 ? -1 : 1;
    }, []);

    const getCurrentActiveVotes = useCallback(() => {
        const st = stateRef.current;
        const base = (st.data.active_votes || []).filter(v => v && v.voter !== props.account);
        if (st._voted === 1 && props.account) base.push({ voter: props.account, weight: 10000, rshares: '0', time: null });
        else if (st._voted === -1 && props.account) base.push({ voter: props.account, weight: -10000, rshares: '0', time: null });
        return base;
    }, [props.account]);

    const triggerPositiveVotes = useCallback(() => { actions.trigger_votes({ sign: '+', votes: getCurrentActiveVotes(), voter_profiles: stateRef.current.data._voter_profiles || {} }); }, [getCurrentActiveVotes]);
    const triggerNegativeVotes = useCallback(() => { actions.trigger_votes({ sign: '-', votes: getCurrentActiveVotes(), voter_profiles: stateRef.current.data._voter_profiles || {} }); }, [getCurrentActiveVotes]);

    const upvoteToggle = useCallback(() => {
        const st = stateRef.current;
        if (!props.account) return;
        if (st._upvoteLoading || st._downvoteLoading) return;
        const a = (st.data.author || {}).username, p = st.data.permlink;
        if (!a || !p) return;
        dispatch({ _upvoteLoading: true });
        const newV = st._voted !== 1 ? 1 : 0, w = newV === 1 ? 10000 : 0;
        if (props.api) {
            props.api.broadcast.vote(props.account, a, p, w)
                .then((res) => {
                    // res.outcome: 'nothing' | 'positive' | 'negative' | 'withdrawal'
                    if (!res || res.outcome === 'nothing') return; // cancelled — leave UI as-is
                    const fw = res.weight || 0;
                    dispatch({ _voted: fw > 0 ? 1 : fw < 0 ? -1 : 0 });
                    props.onVoteChange?.(p, props.account, fw);
                })
                .catch((e) => console.warn('[PostDialog] vote failed:', e.message))
                .finally(() => dispatch({ _upvoteLoading: false }));
        } else dispatch({ _upvoteLoading: false });
    }, [props.api, props.account, props.onVoteChange]);

    const downvoteToggle = useCallback(() => {
        const st = stateRef.current;
        if (!props.account) return;
        if (st._upvoteLoading || st._downvoteLoading) return;
        const a = (st.data.author || {}).username, p = st.data.permlink;
        if (!a || !p) return;
        dispatch({ _downvoteLoading: true });
        const newV = st._voted !== -1 ? -1 : 0, w = newV === -1 ? -10000 : 0;
        if (props.api) {
            props.api.broadcast.vote(props.account, a, p, w)
                .then((res) => {
                    // res.outcome: 'nothing' | 'positive' | 'negative' | 'withdrawal'
                    if (!res || res.outcome === 'nothing') return; // cancelled — leave UI as-is
                    const fw = res.weight || 0;
                    dispatch({ _voted: fw > 0 ? 1 : fw < 0 ? -1 : 0 });
                    props.onVoteChange?.(p, props.account, fw);
                })
                .catch((e) => console.warn('[PostDialog] vote failed:', e.message))
                .finally(() => dispatch({ _downvoteLoading: false }));
        } else dispatch({ _downvoteLoading: false });
    }, [props.api, props.account, props.onVoteChange]);

    const submitComment = useCallback(async () => {
        const st = stateRef.current;
        if (!props.account) return;
        if (!props.api) return;
        if (st._comment_sending) return; // async now — a second click mid-gate must not double-broadcast
        const tf = document.getElementById("comment-textfield");
        const body = (tf?.value !== undefined ? tf.value : (tf?.querySelector?.("input, textarea")?.value || "")).trim();
        if (!body) { actions.trigger_snackbar(t("words.comment_cannot_be_empty")); return; }

        // ── TOXIC COMMENT HELPER — pre-broadcast check. Instant when the
        //    debounced pass already scored this exact text (LRU-cached in the
        //    package), a no-op when the setting is off. First flagged click
        //    warns; a second click on the unchanged text broadcasts anyway. ──
        if (await toxicity.confirm_before_send("comment-textfield", body)) {
            actions.trigger_snackbar(t("words.this_might_come_across_as_toxic_press"));
            return;
        }

        // ── EDIT MODE — the textfield holds the new body of an existing comment.
        //    Same permlink + same parent ⇒ the chain treats the broadcast as an
        //    update; api.broadcast.updateComment computes the diff-match-patch
        //    against the raw on-chain body and sends whichever is smaller. ──
        const et = st._edit_target;
        if (et) {
            const c = et.comment || {};
            const ca = c.username || (c.author || {}).username;
            const cpl = c.permlink;
            if (!ca || !cpl || ca !== props.account) { dispatch({ _edit_target: null }); return; }
            if (body === (et.rawBody || "").trim()) {
                // Nothing changed — just leave edit mode.
                dispatch({ _edit_target: null });
                setTextFieldValue("comment-textfield", "");
                return;
            }
            dispatch({ _comment_sending: true });
            props.api.broadcast.updateComment({ author: ca, permlink: cpl, body })
                .then(() => {
                    let sanitized = body;
                    try { sanitized = rawSanitizeComment(body).html || body; } catch (e) {}
                    const updated = (stateRef.current._comments || []).map(x =>
                        (x.permlink === cpl && (x.username || (x.author || {}).username) === ca)
                            ? { ...x, body: sanitized }
                            : x
                    );
                    dispatch({ _comments: updated, _comment_sending: false, _edit_target: null });
                    setTextFieldValue("comment-textfield", "");
                    actions.trigger_snackbar(t("words.comment_updated"));
                })
                .catch((e) => {
                    console.warn('[PostDialog] comment update failed:', e.message);
                    actions.trigger_snackbar(e.message || "Failed to update comment");
                    dispatch({ _comment_sending: false });
                });
            return;
        }

        const rt = st._reply_target;
        const pa = rt ? (rt.username || (rt.author || {}).username) : (st.data.author || {}).username;
        const pp = rt ? rt.permlink : st.data.permlink;
        if (!pa || !pp) return;
        const cp = "re-" + pa + "-" + pp + "-" + Date.now().toString(36);
        dispatch({ _comment_sending: true });
        props.api.broadcast.comment({ parentAuthor: pa, parentPermlink: pp, author: props.account, permlink: cp, title: "", body, jsonMetadata: JSON.stringify({ app: "pixagram", format: "text" }) })
            .then(() => {
                let sanitized = body; try { sanitized = rawSanitizeComment(body).html || body; } catch(e) {}
                const la = st._authors || {}, la2 = st._accounts || {};
                const profile = la[props.account] || la2[props.account] || { username: props.account, name: props.account, image: "" };
                const opt = { username: props.account, body: sanitized, date: Date.now(), upVotesNumber: 0, downVotesNumber: 0, permlink: cp, children: 0, active_votes: [], author: profile, parent_author: pa, parent_permlink: pp, _optimistic: true };
                dispatch({ _comments: [opt].concat(st._comments), _comment_sending: false, _reply_target: null });
                if (tf) { const inp = tf.querySelector?.("input, textarea"); if (inp) inp.value = ""; else if (tf.value !== undefined) tf.value = ""; const ev = new Event("input", { bubbles: true }); (inp || tf).dispatchEvent(ev); }
                actions.trigger_snackbar(t("components.post_dialog.comment_posted"));
                if (rt) rt.children = (rt.children || 0) + 1; else if (st.data) st.data.children = (st.data.children || 0) + 1;
                props.onCommentPost?.({ parentAuthor: pa, parentPermlink: pp, author: props.account, permlink: cp, body, postAuthor: (st.data.author || {}).username, postPermlink: st.data.permlink, optimisticComment: opt });
                startCommentRefresh();
            })
            .catch((e) => { console.warn('[PostDialog] comment broadcast failed:', e.message); actions.trigger_snackbar(t("words.failed_to_post_comment")); dispatch({ _comment_sending: false }); });
    }, [props.api, props.account, props.onCommentPost, startCommentRefresh]);

    /* ================================================================
     * COMMENT EDIT / DELETE (own comments — dialog-only by design)
     * ================================================================ */

    // Enter edit mode: load the RAW on-chain body (the rendered list holds
    // sanitized HTML — patching must start from the exact stored bytes),
    // pre-fill the bottom textfield with it and flag the edit target.
    const startEditComment = useCallback((comment) => {
        if (!props.account || !props.api) return;
        const ca = comment.username || (comment.author || {}).username;
        if (!ca || ca !== props.account || !comment.permlink) return;
        dispatch({ _reply_target: null, _tab_value: 1 });
        props.api.content.getContent(ca, comment.permlink, { raw: true })
            .then((raw) => {
                if (!raw || !raw.author) { actions.trigger_snackbar(t("words.could_not_load_the_comment_for_editing")); return; }
                dispatch({ _edit_target: { comment, rawBody: raw.body || "" } });
                setTextFieldValue("comment-textfield", raw.body || "");
                setTimeout(() => { const tf = document.getElementById("comment-textfield"); if (tf) { const inp = tf.querySelector?.("input, textarea"); (inp || tf).focus(); } }, 250);
            })
            .catch((e) => {
                console.warn('[PostDialog] edit load failed:', e.message);
                actions.trigger_snackbar(t("words.could_not_load_the_comment_for_editing"));
            });
    }, [props.api, props.account]);

    const cancelEditComment = useCallback(() => {
        dispatch({ _edit_target: null });
        setTextFieldValue("comment-textfield", "");
    }, []);

    const requestDeleteComment = useCallback((comment) => {
        if (!props.account) return;
        const ca = comment.username || (comment.author || {}).username;
        if (!ca || ca !== props.account) return;
        dispatch({ _delete_target: comment });
    }, [props.account]);

    const cancelDeleteComment = useCallback(() => {
        dispatch({ _delete_target: null });
    }, []);

    // Called by DeleteCommentModal once the delete_comment broadcast succeeds.
    // The modal owns the network call + its own loading state; here we only
    // reconcile local state (drop the comment, fix the count, clear any edit).
    const handleCommentDeleted = useCallback((c) => {
        const ca = c.username || (c.author || {}).username;
        const cpl = c.permlink;
        const remaining = (stateRef.current._comments || []).filter(x =>
            !(x.permlink === cpl && (x.username || (x.author || {}).username) === ca)
        );
        // If the deleted comment was being edited, drop the edit too.
        const wasEditing = stateRef.current._edit_target?.comment?.permlink === cpl;
        dispatch({
            _comments: remaining, _delete_target: null,
            ...(wasEditing ? { _edit_target: null } : {}),
        });
        if (wasEditing) setTextFieldValue("comment-textfield", "");
        if (stateRef.current.data) stateRef.current.data.children = Math.max(0, (stateRef.current.data.children || 1) - 1);
        actions.trigger_snackbar(t("words.comment_deleted"));
    }, []);

    /* ================================================================
     * POST METADATA EDIT (own post — EditPostDialog)
     * ================================================================ */

    const openEditPost = useCallback(() => { dispatch({ _edit_post_open: true }); }, []);
    const closeEditPost = useCallback(() => { dispatch({ _edit_post_open: false }); }, []);

    // Reflect a successful metadata edit into the open dialog immediately;
    // the `content_updated` event takes care of the feed pages behind it.
    const handlePostEdited = useCallback((payload) => {
        const st = stateRef.current;
        if (!st.data || st.data.permlink !== payload.permlink) return;
        const newData = {
            ...st.data,
            title: payload.title,
            tags: payload.tags || [],
            nsfw: !!payload.nsfw,
            deleted: !!payload.deleted,
            // Keep the metadata string current so the license viewer
            // (handleOpenLicenseDialog parses data.json_metadata) reflects
            // an edited license without a refetch.
            ...(payload.jsonMetadata ? { json_metadata: payload.jsonMetadata } : {}),
        };
        dispatch({ data: newData });
        // A post marked deleted (or with its artwork erased) should not stay
        // on screen — close the dialog and let the host page refetch.
        if (payload.deleted || payload.bodyErased) {
            props.onClose?.();
        }
    }, [props.onClose]);

    const replyToComment = useCallback((commentData, ancestors) => {
        // Replying while editing abandons the edit — blank the pre-filled body.
        if (stateRef.current._edit_target) setTextFieldValue("comment-textfield", "");
        const anc = Array.isArray(ancestors) ? ancestors : [];
        const cc = stateRef.current._current_comments.concat(...anc, commentData);
        dispatch({ _current_comments: cc, _reply_target: commentData, _edit_target: null, _tab_value: 1 });
        const a = commentData.username || (commentData.author || {}).username, p = commentData.permlink;
        if (a && p) fetchRepliesFor(a, p);
        setTimeout(() => { const tf = document.getElementById("comment-textfield"); if (tf) { const inp = tf.querySelector?.("input, textarea"); (inp || tf).focus(); } }, 300);
    }, [fetchRepliesFor]);

    /* ================================================================
     * REF CALLBACKS
     * ================================================================ */
    const setViewRefCb = useCallback((el) => {
        if (el) {
            viewRef.current = el; // gestures attach here; geometry is arithmetic now
            computeSize();
        }
    }, [computeSize]);

    const setImageRefCb = useCallback((el) => {
        if (el) imageRef.current = el;
    }, []);

    const setCanvasRefCb = useCallback((can) => {
        if (!can || typeof can.getContext !== "function") return;
        can.context = can.getContext("bitmaprenderer");
        // Defense in depth: STYLE_CANVAS_CONTEXT already declares
        // visibility: hidden, but on a remount triggered mid-pipeline
        // (e.g. parent re-keys during a fast nav) the inline style from
        // React's first commit could race the ref callback. Asserting it
        // here ensures the freshly-attached DOM node is invisible from
        // the very first frame of its existence, regardless of commit
        // ordering. The reveal happens later in setImgd.
        can.style.visibility = "hidden";
        canvasRef.current = can;
        const st = stateRef.current;
        if (st.metadata?.imgd && st._size?.width) renderPipeline(st.renderer, st.metadata.imgd, st._size, st.mode);
    }, [renderPipeline]);

    const setMenuCardRefCb = useCallback((ref) => {
        if (!ref) return;
        cardRef.current = ref;
        cardWrapperRef.current = ref.parentElement;
    }, []);

    // Stable ref callbacks for the two blur backplate <img>s. We hold them
    // on `inst` so the setImgd reveal step can flip their src imperatively
    // (atomic with canvas reveal — see comment in setImgd). The callbacks
    // themselves are stable (empty deps) so React never re-invokes them on
    // re-render, which means the <img> elements are never remounted and we
    // never get a half-decoded blur in a transient frame.
    const setBlur1RefCb = useCallback((el) => {
        if (!el) return;
        inst.blurEl1 = el;
        // If we already know the displayed image, restore it on remount.
        if (inst.committedImage && el.getAttribute("src") !== inst.committedImage) el.src = inst.committedImage;
    }, []);
    const setBlur2RefCb = useCallback((el) => {
        if (!el) return;
        inst.blurEl2 = el;
        if (inst.committedImage && el.getAttribute("src") !== inst.committedImage) el.src = inst.committedImage;
    }, []);

    // Ref to the inner div that wraps blurs + canvas. Held on `inst` so
    // setImgd can flip its opacity imperatively (0 before paint, 1 the
    // instant the canvas has its new pixels committed at the start
    // position) without round-tripping through React state.
    const setInnerRefCb = useCallback((el) => {
        if (!el) return;
        inst.innerEl = el;
        // Initial state: hidden until the first paint commits.
        if (!inst.committedImage) el.style.opacity = "0";
    }, []);

    /* ================================================================
     * EFFECTS — lifecycle
     * ================================================================ */

    // Mount
    useEffect(() => {
        fetchComments();
        cacheOwnProfile();
        window.addEventListener("resize", debouncedComputeSize, { passive: true });
        return () => {
            window.removeEventListener("resize", debouncedComputeSize, { passive: true });
            if (inst.commentRefreshTimer) clearInterval(inst.commentRefreshTimer);
            if (inst.twoPointerTimeout) clearTimeout(inst.twoPointerTimeout);
            if (inst.rafDragId) cancelAnimationFrame(inst.rafDragId);
            if (inst.rafCardId) cancelAnimationFrame(inst.rafCardId);
            if (inst.rafWheelId) cancelAnimationFrame(inst.rafWheelId);
            if (inst.resizeRaf) cancelAnimationFrame(inst.resizeRaf);
            if (inst.heroTransitionTimer) clearTimeout(inst.heroTransitionTimer);
            if (inst.closingHeroTimer) clearTimeout(inst.closingHeroTimer);
            if (inst.navDismissTimer) clearTimeout(inst.navDismissTimer);
            if (inst.navBounceTimer) clearTimeout(inst.navBounceTimer);
            if (inst.closeResetTimer) clearTimeout(inst.closeResetTimer);
            if (inst.scrollMomentumRaf) cancelAnimationFrame(inst.scrollMomentumRaf);
            discardPreview();
        };
    }, []);

    // ── URL hash → state (browser back/forward + same-pathname hash edits) ─
    // The drawer state is mirrored in the URL hash; when the URL changes
    // (typically because the user pressed the browser back arrow, but also
    // because *we* wrote it through HISTORY.back() from a manual close),
    // sync the reducer state to whatever the URL now says.
    //
    // Cross-pathname history changes are intentionally ignored here: they
    // mean a different post (or a non-post URL) is being navigated to, and
    // Feed/Profile's syncFromUrl + our own props-sync effect take care of
    // initialising the new post's tab + drawer-open state from its hash.
    //
    // When a goBack pops the drawer-push we previously notified the parent
    // about via `onDrawerPush`, notify the parent again through
    // `onDrawerPop` so its history-depth counter (used by closePost) stays
    // accurate. The signature is "hash transitioned from non-empty to
    // empty on the same pathname" — that's the exact shape of a drawer
    // close via goBack and nothing else.
    useEffect(() => {
        let lastPath = HISTORY.location.pathname;
        let lastHash = HISTORY.location.hash || "";
        const unlisten = HISTORY.listen((h) => {
            const newPath = h.location.pathname;
            const newHash = h.location.hash || "";
            const pathChanged = newPath !== lastPath;
            const prevHash = lastHash;
            lastPath = newPath;
            lastHash = newHash;
            if (pathChanged) return;
            const st = stateRef.current;
            if (!st.open) return;
            const hashTab = parsePostDrawerHash(newHash);
            const wantTab = hashTab !== null ? hashTab : 0;
            const wantOpen = hashTab !== null;
            // A drawer-push got popped — same pathname, hash went away.
            // Notify the parent so its history-depth counter stays in sync.
            if (st._view_mobile_opened && !wantOpen && prevHash && !newHash) {
                props.onDrawerPop?.();
            }
            if (st._tab_value === wantTab && st._view_mobile_opened === wantOpen) return;
            dispatch({ _tab_value: wantTab, _view_mobile_opened: wantOpen });
        });
        return unlisten;
    }, [props.onDrawerPop]);

    // ── State → URL hash ────────────────────────────────────────────────
    // Idempotent writer: reconciles the URL hash with the live drawer
    // state. Push vs replace is decided from the *current* URL hash (which
    // reflects the URL state immediately before this write), not from a
    // remembered React state — that way arrow-navigation between posts
    // (which keeps `_view_mobile_opened` true via preserveDrawer but lands
    // on a fresh post URL with no hash) doesn't get mis-classified as a
    // "drawer just opened" event.
    //
    //   - mobile + currentHash empty + desiredHash non-empty → push
    //     (the user explicitly opened the drawer; back arrow should close
    //      the drawer without unmounting the dialog)
    //   - everything else → replace
    //
    // When we push, we notify the parent through `onDrawerPush` so its
    // `historyDepthRef` (used by closePost to compute how far to go back)
    // stays accurate. Without this, closing the dialog while the drawer
    // is open on mobile would land back on the bare post URL, which the
    // parent's syncFromUrl would immediately re-open. The matching pop is
    // handled by the parent's closePost reading the live hash.
    const prevPathRef = useRef(HISTORY.location.pathname);
    useEffect(() => {
        const currentPath = HISTORY.location.pathname;
        const pathJustChanged = prevPathRef.current !== currentPath;
        prevPathRef.current = currentPath;
        if (!state.open) return;

        const isMobile = state._view_right_mobile_enabled;
        // On desktop the drawer panel is always visible, regardless of
        // `_view_mobile_opened`, so the URL always carries the active tab.
        const drawerOpen = isMobile ? state._view_mobile_opened : true;
        const baseHash = drawerOpen ? (POST_DRAWER_TAB_HASHES[state._tab_value] || "") : "";
        // While a comment is pinned, keep its focus param in the URL so the
        // address bar stays a shareable deep-link to this exact thread state.
        const desiredHash = (baseHash && state._focusComment)
            ? buildCommentFocusHash(state._focusComment.author, state._focusComment.permlink, baseHash)
            : baseHash;
        const currentHash = HISTORY.location.hash || "";
        if (currentHash === desiredHash) return;

        // Cross-pathname renders (e.g. arrow-nav lands on a fresh post URL
        // while the drawer stays visually open) must not push — they'd
        // double the back-stack entry for what is conceptually a single
        // step. Same rule already covers the dialog's very first open.
        const usesPush =
            isMobile && !currentHash && !!desiredHash && !pathJustChanged;
        const url = currentPath + desiredHash;
        if (usesPush) {
            HISTORY.push(url);
            props.onDrawerPush?.();
        } else {
            HISTORY.replace(url);
        }
    }, [state.open, state._tab_value, state._view_mobile_opened, state._view_right_mobile_enabled, state._focusComment, props.onDrawerPush]);

    // ── Focused-comment path (deep-link "#replies&focus=…") ─────────────
    // Resolve the pinned comment's ancestor chain down from the thread's top
    // level, as "author/permlink" keys. CommentInList brightens exactly these
    // segments of the tree — and because the keys are global rather than
    // positional, they stay valid across sorts and "Show replies" re-roots.
    useEffect(() => {
        const f = state._focusComment;
        const api = props.api;
        if (!state.open || !f || !api || !api.content) return;
        const rootAuthor = ((stateRef.current.data || {}).author || {}).username;
        const rootPermlink = (stateRef.current.data || {}).permlink;
        let cancelled = false;
        (async () => {
            const keys = [];
            let a = f.author, p = f.permlink;
            try {
                for (let hop = 0; hop < 12 && !cancelled; hop++) {
                    keys.push(a + "/" + p);
                    const c = await api.content.getContent(a, p);
                    if (!c || !c.permlink) break;
                    const pa = c.parent_author || "";
                    const pp = c.parent_permlink || "";
                    // Parent is the post itself (or a thread root): the chain
                    // of COMMENT keys below it is complete.
                    if (!pa || (pa === rootAuthor && pp === rootPermlink)) break;
                    a = pa; p = pp;
                }
            } catch (e) {}
            if (!cancelled) dispatch({ _focusPathKeys: keys });
        })();
        return () => { cancelled = true; };
    }, [state.open, state._focusComment, props.api]);

    // Scroll the pinned comment into view once its node exists. The thread
    // arrives in waves (top level, then each level's lazily loaded replies),
    // so seek with a short-lived poll instead of assuming it's mounted.
    useEffect(() => {
        const f = state._focusComment;
        if (!state.open || !f) return;
        const key = (f.author || "") + "/" + (f.permlink || "");
        let tries = 0;
        let timer = 0;
        let done = false;
        const seek = () => {
            if (done) return;
            let el = null;
            try { el = document.querySelector('[data-comment-key="' + CSS.escape(key) + '"]'); } catch (e) {}
            if (el) {
                done = true;
                try { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
                catch (e) { el.scrollIntoView(); }
                return;
            }
            if (++tries < 40) timer = setTimeout(seek, 250);
        };
        timer = setTimeout(seek, 250);
        return () => { done = true; clearTimeout(timer); };
    }, [state.open, state._focusComment, state._comments]);

    // Props changed (data, open, api, account)
    const prevPropsRef = useRef({});

    /* PRE-PAINT CANVAS CLEAR — runs synchronously after React commits new
     * props and BEFORE the browser paints. The main props-changed handler
     * below is a `useEffect`, which fires post-paint; on a nav-to-next that
     * left a window of at least one frame where React had committed the
     * new `data` prop but the canvas bitmap still carried the previous
     * artwork's pixels — the user perceived this as "the old image flashes
     * for ~50ms before the new one appears". A layout effect closes that
     * window: by the time the browser composites the first frame with the
     * new props, the bitmap has already been zeroed and visibility flipped
     * to hidden. Width, height, and `_cachedAR` are reset here too so the
     * subsequent `setImgd` is forced through its full resize+paint path
     * rather than a partial `clearRect`-only fast path that would silently
     * skip the size update.
     *
     * We use a dedicated ref instead of reading from `prevPropsRef` so this
     * effect's bookkeeping cannot race the post-paint effect below that
     * also reads/writes `prevPropsRef`.
     *
     * The `open` transition is treated like an image change: reopening the
     * SAME post (same data.image url) after a close must still reset the
     * canvas, because the canvas state may have been corrupted by the
     * fade-out animation or a prior teardown. Without this, the second
     * open shows nothing — the bitmap stays at 0×0 from the close-reset
     * teardown and setImgd's `needsResize` check is false because the
     * cached `can._cachedAR` happens to match. */
    const prevImageRef = useRef(undefined);
    const prevOpenRef = useRef(false);
    useLayoutEffect(() => {
        const img = props.data?.image;
        const open = props.open;
        const newlyOpened = open && !prevOpenRef.current;
        prevOpenRef.current = open;
        if (prevImageRef.current === img && !newlyOpened) return;
        prevImageRef.current = img;
        const can = canvasRef.current;
        if (can) {
            can.width = 0; can.height = 0; can._cachedAR = null;
            can.style.visibility = "hidden";
        }
        // Hide the inner wrapper (canvas + blurs) BEFORE the browser paints
        // the new props' first frame. setImgd will flip this back to "1"
        // once it has positioned and painted the canvas — that's the
        // "before animation starts opacity is 0, then immediately 1"
        // ordering. Without this, the inner div might paint at opacity 1
        // for one frame on top of a still-clearing or just-cleared canvas.
        if (inst.innerEl) inst.innerEl.style.opacity = "0";
    });

    useEffect(() => {
        const prev = prevPropsRef.current;
        const isNewlyClosed = !props.open && prev.open === true;
        // A reopen (closed→open) ALWAYS counts as a new image, even if the
        // URL is identical to the last one shown. Otherwise the pipeline
        // shorts on `isNewImage === false`, the canvas never repaints, and
        // the user sees nothing on the second open of the same post.
        // (The fast-reopen path — within 600 ms, where the close-reset
        // timer hasn't fired yet — used to be the only way to trigger
        // this, but the slow path was also broken because the close-reset
        // didn't clear prevPropsRef.data. We belt-and-brace by treating
        // newly-opened as new-image here too.)
        const isNewlyOpened = props.open && !prev.open;
        const isNewImage = isNewlyOpened || (props.data?.image !== prev.data?.image);
        const isNewPost = isNewlyOpened || (props.data?.id !== prev.data?.id) || (props.data?.image !== prev.data?.image);
        const kb = ((props.data?.image || "").length || 0) / 1000 * 3 / 4;
        const type = (props.data?.image || "").startsWith("data:image/png;base64,") ? "png"
            : (props.data?.image || "").startsWith("data:image/webp;base64,") ? "webp" : "unknown";

        // ── Close path ───────────────────────────────────────────────────
        // The Backdrop's fade-out animation is driven by `state.open`, so it
        // only plays cleanly if `state.data` is still the image we were just
        // showing. Clearing data here (or kicking the metadata pipeline with
        // an empty image, which loops back to `dispatch({ _hidden: false })`
        // on a now-stale canvas) causes a brief, ugly intermediate frame:
        // the close anim runs against an empty canvas and the blur <img>s
        // either go blank or show their last src in a half-painted state.
        //
        // So on close we only flip `state.open` to false and stop the
        // running nav timers immediately — everything else (data, metadata,
        // _hidden, _hidden2, tab/drawer state, the painted canvas) is left
        // untouched for 600 ms so the Backdrop fade-out + image close anim
        // both finish against the correct content. The delayed reset then
        // drops the now-invisible state so a future reopen doesn't briefly
        // flash the stale post before its own init runs, and so we aren't
        // holding the previous image in memory indefinitely.
        //
        // The reset is cancelled on reopen (below) and on unmount — a
        // reopen-within-600 ms must not clobber the freshly-set state, and
        // an unmount must not fire a dispatch on a torn-down reducer.
        if (isNewlyClosed) {
            inst.navTransitioning = false; inst.navDismissing = false; inst.navBouncing = false;
            inst.navDirection = null;
            if (inst.navDismissTimer) { clearTimeout(inst.navDismissTimer); inst.navDismissTimer = null; }
            if (inst.navBounceTimer) { clearTimeout(inst.navBounceTimer); inst.navBounceTimer = null; }
            if (inst.navSafetyTimer) { clearTimeout(inst.navSafetyTimer); inst.navSafetyTimer = null; }
            if (inst.commentRefreshTimer) { clearInterval(inst.commentRefreshTimer); inst.commentRefreshTimer = null; }
            dispatch({ open: false, _download_ready: null });
            prevPropsRef.current = { data: prev.data, open: props.open, account: props.account };

            if (inst.closeResetTimer) clearTimeout(inst.closeResetTimer);
            inst.closeResetTimer = setTimeout(() => {
                inst.closeResetTimer = null;
                // If the dialog has been reopened in the meantime, abort —
                // reopen paths set state.open back to true and we'd undo
                // their work otherwise.
                if (stateRef.current.open) return;
                inst.currentRenderId++;
                clearCanvas();
                clearBlurImages();
                discardPreview();
                inst.positionSetForId = null;
                inst.drawerHasAppeared = false;
                inst.heroAnimating = false; inst.originRect = null;
                inst.closingHero = false;
                if (inst.closingHeroTimer) { clearTimeout(inst.closingHeroTimer); inst.closingHeroTimer = null; }
                // Drop the cached blur-swap commit so a reopen with the
                // SAME image still triggers a fresh swap (otherwise the
                // "committedImage === want" check would short-circuit and
                // the blur DOM would never reattach the src after a remount).
                inst.committedImage = null;
                inst.renderedImageData = null; inst.renderedKey = null;
                // Clear our "previous props" snapshots too. Without this,
                // reopening the SAME post after a close compares the new
                // props against the cached old props, finds `isNewImage`
                // false (same image url) and `isNewPost` false (same id),
                // and short-circuits the entire metadata/render pipeline —
                // leaving a blank canvas. The two refs serve different
                // bookkeeping (one for the main effect's diff, one for the
                // canvas-reset layoutEffect's diff), so both must be reset.
                prevPropsRef.current = {};
                prevImageRef.current = undefined;
                dispatch({
                    data: {}, kb: 0, type: "",
                    _closing: false,
                    _hidden: true, _hidden2: true,
                    _tab_value: 0, _view_mobile_opened: false,
                    _copied: false, _download_loading: false, _download_ready: null,
                    _comments: [], _current_comments: [],
                    _reply_target: null, _comment_sending: false,
                    _edit_target: null, _delete_target: null,
                    _edit_post_open: false,
                    metadata: { imgd: null, colors: [], width: 0, height: 0 }
                });
            }, 600);
            return;
        }

        // Reopen (or any non-close props change) — cancel a pending reset
        // from a recent close so it can't fire after fresh state has been
        // installed.
        if (inst.closeResetTimer) {
            clearTimeout(inst.closeResetTimer);
            inst.closeResetTimer = null;
        }

        if (isNewImage) {
            inst.currentRenderId++;
            clearCanvas();
            discardPreview(); // outgoing artwork's card snapshot (if any) dies with it
            inst.renderedImageData = null; inst.renderedKey = null;
            if (inst.commentRefreshTimer) { clearInterval(inst.commentRefreshTimer); inst.commentRefreshTimer = null; }
        }

        const extra = {};
        // A new post must never inherit a reverse-hero in progress. Two
        // ways in:
        //   • the fast reopen (closed→open inside the 600 ms teardown
        //     window, which cancels the reset above — otherwise the only
        //     thing that clears these);
        //   • a click that lands on ANOTHER card while we are still flying
        //     home. classes.closingChrome makes the dialog click-through
        //     for the whole flight, so that click reaches the masonry and
        //     the host hands us the new post — but `props.open` never went
        //     false, so `isNewlyOpened` is false and the flight's
        //     bookkeeping would outlive the post it belonged to: its
        //     440 ms timer would fire props.onClose() and close the post
        //     the user just picked, and `_closing` would leave the chrome
        //     faded out and click-through for good.
        // `isNewPost` is a superset of `isNewlyOpened`, so it covers both.
        if (isNewPost) {
            extra._closing = false;
            if (inst.closingHero) {
                inst.closingHero = false;
                // The flight parked inline opacity:0 + its own transition
                // on the blur backplates (the card has no halo, so they
                // were faded out of the landing). Clear both so the new
                // post's blurFadeIn starts from a clean slate —
                // clearBlurImages does this on the close path, which never
                // runs when the dialog stays open through the swap.
                [inst.blurEl1, inst.blurEl2].forEach((b) => {
                    if (!b) return;
                    b.style.opacity = "";
                    b.style.transition = "";
                });
            }
            if (inst.closingHeroTimer) { clearTimeout(inst.closingHeroTimer); inst.closingHeroTimer = null; }
        }
        if (isNewPost) {
            const iv = resolveInitialVoted(props.data, props.account);
            Object.assign(extra, { _initialVoted: iv, _voted: iv, _comments: [], _current_comments: [], _comments_loading: false, _comment_sending: false, _reply_target: null, _edit_target: null, _delete_target: null, _edit_post_open: false, _focusComment: null, _focusPathKeys: [] });
            inst.cachedViews = null; inst.cachedViewsKey = null; inst.sortedCommentsCache = null; inst.sortedCommentsCacheKey = null; inst.sortedCommentsCacheRef = null;
        } else if (props.data?.active_votes !== prev.data?.active_votes) {
            const iv = resolveInitialVoted(props.data, props.account);
            Object.assign(extra, { _initialVoted: iv, _voted: iv });
        }

        dispatch({ open: props.open, data: props.data || {}, renderer: props.renderer, mode: props.mode, locales: props.locales, format: props.format, kb, type, ...extra });

        if (isNewPost && !inst.navTransitioning && props.originRect?.width > 0) {
            inst.originRect = props.originRect; inst.heroAnimating = true;
            inst.positionSetForId = null; inst.drawerHasAppeared = false;
            // Snapshot the clicked card's canvas NOW, while it is still on
            // screen right where the click happened — renderPipeline flies
            // this bitmap so the hero never waits on a pool render.
            capturePreview(props.data?.id);
        } else if (isNewPost) {
            inst.originRect = null; inst.heroAnimating = false;
            inst.positionSetForId = null;
            if (!inst.navTransitioning) inst.drawerHasAppeared = false;
            // Hero-less open (deep link, back/forward, nav): no card bitmap
            // to fly — make sure no stale snapshot lingers either.
            discardPreview();
        }

        if (isNewPost) fetchComments();
        if (props.account && props.account !== prev.account) cacheOwnProfile();

        if (isNewImage) {
            const preserveDrawer = inst.navTransitioning || inst.navBouncing;
            // Read the URL hash so deep-links (and back/forward across post
            // URLs that carry a hash) restore the drawer in the right tab
            // immediately. Arrow-nav between posts keeps the live drawer
            // state instead — preserveDrawer wins over the (likely empty)
            // hash on the new post URL.
            const hashTab = preserveDrawer
                ? null
                : parsePostDrawerHash(HISTORY.location.hash);
            const nextTab = preserveDrawer
                ? stateRef.current._tab_value
                : (hashTab !== null ? hashTab : 0);
            const nextDrawerOpen = preserveDrawer
                ? stateRef.current._view_mobile_opened
                : (hashTab !== null);
            dispatch({
                _tab_value: nextTab,
                _view_mobile_opened: nextDrawerOpen,
                // Deep-linked comment focus rides the hash ("#replies&focus=…").
                // Arrow-nav (preserveDrawer) lands on a different post — any
                // previous focus belongs to the old one, so it clears.
                _focusComment: preserveDrawer ? null : parseCommentFocusHash(HISTORY.location.hash),
                _focusPathKeys: [],
                _hidden: true, _hidden2: preserveDrawer ? false : true, _copied: false,
                _download_loading: false, _download_ready: null,
                metadata: { imgd: null, colors: [], width: 0, height: 0 }
            });
        }

        // Only run the metadata pipeline when we actually have an image —
        // guards against an unintended reopen path or stale prop where
        // `data.image` is falsy. The pipeline ends in dispatch({_hidden:
        // false}) which would otherwise reveal an unpainted canvas.
        if (isNewImage && props.data?.image) {
            const renderId = inst.currentRenderId;
            const metaSource = props.data?.size?.imgd ? props.data.size : props.data.image;
            requestAnimationFrame(() => {
                if (renderId !== inst.currentRenderId) return;
                getMetadata(metaSource).then((result) => {
                    if (renderId !== inst.currentRenderId) return;
                    if (!result) {
                        // No metadata (e.g. missing/invalid image) — unlock nav + drawer
                        inst.navTransitioning = false; inst.navBouncing = false;
                        inst.navDismissing = false; inst.navDirection = null;
                        if (inst.navSafetyTimer) { clearTimeout(inst.navSafetyTimer); inst.navSafetyTimer = null; }
                        dispatch({ _hidden: false, _hidden2: false });
                        return;
                    }
                    inst.currentZoom = 1.33;
                    dispatch({ metadata: result, zoom: 1.33, _hidden2: false });
                    computeSize();
                    // Deferred palette: analyze_colors used to run BEFORE the
                    // metadata dispatch, so the hero's first frame waited on a
                    // full-source WASM palette scan. The drawer's color chips
                    // are its only consumer — compute on idle and patch the
                    // metadata in place (the memo comparators key on
                    // colors.length, so exactly the panels that show it
                    // re-render, nothing else).
                    if (!result.colors && result.imgd) {
                        const fillColors = () => {
                            if (renderId !== inst.currentRenderId) return;
                            let colors = [];
                            try { colors = analyze_colors(result.imgd.data, 256, "hilbert").to_json(); } catch (e) {}
                            const md = stateRef.current.metadata;
                            if (md && md.imgd === result.imgd) dispatch({ metadata: { ...md, colors } });
                        };
                        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
                            window.requestIdleCallback(fillColors, { timeout: 1500 });
                        } else {
                            setTimeout(fillColors, 600); // ≈ after the hero lands
                        }
                    }
                }).catch(() => {
                    // getMetadata failed — unlock nav + drawer so UI isn't permanently stuck
                    inst.navTransitioning = false; inst.navBouncing = false;
                    inst.navDismissing = false; inst.navDirection = null;
                    if (inst.navSafetyTimer) { clearTimeout(inst.navSafetyTimer); inst.navSafetyTimer = null; }
                    dispatch({ _hidden: false, _hidden2: false });
                });
            });
        }

        prevPropsRef.current = { data: props.data, open: props.open, account: props.account };
    }, [props.data, props.open, props.account, props.api, props.originRect, props.renderer, props.mode, props.locales, props.format]);

    /* ================================================================
     * DERIVED VALUES (useMemo)
     * ================================================================ */
    const authorsEntries = useMemo(() => Object.entries(state._authors || {}), [state._authors]);

    const sortedComments = useMemo(() => {
        const c = state._comments, s = state._sorting;
        return c.slice().sort((a, b) => {
            if (s === "Votes") return (b.upVotesNumber - b.downVotesNumber) - (a.upVotesNumber - a.downVotesNumber);
            if (s === "New") return ((typeof b.date === "string" ? new Date(b.date).getTime() : (b.date || 0)) - (typeof a.date === "string" ? new Date(a.date).getTime() : (a.date || 0)));
            return ((b.upVotesNumber || 0) + (b.children || 0)) - ((a.upVotesNumber || 0) + (a.children || 0));
        });
    }, [state._comments, state._sorting]);

    const votesRenderer = useCallback(({ index, key, style }) => {
        const author = authorsEntries[index]?.[1];
        if (!author) return null;
        return (
            <ListItem key={key} style={style}>
                <ListItemAvatar>
                    <Tooltip title={`@${author.username}`}>
                        <Avatar src={author.image} style={{ borderRadius: "12px", cursor: "pointer" }} className="pixelated" onClick={() => openAuthor(author.username)} />
                    </Tooltip>
                </ListItemAvatar>
                <ListItemText primary={author.name} secondary="0.1 PS with 100%" />
            </ListItem>
        );
    }, [authorsEntries, openAuthor]);

    /* ================================================================
     * RENDER
     * ================================================================ */
    const { open, data, metadata, locales, renderer, mode,
        _closing,
        _hidden, _hidden2, _tab_value, _view_mobile_opened,
        _view_right_mobile_enabled, _license_dialog_opened, _license_base,
        _license_customization, _download_loading, _download_ready, _voted, _initialVoted,
        _upvoteLoading, _downvoteLoading, _comment_sending, _reply_target,
        _edit_target, _delete_target, _edit_post_open, _is_favorite,
        _size, zoom, kb, type, _copied, _sorting, _comments, _current_comments,
        _show_parent, _comments_loading, _focusComment, _focusPathKeys
    } = state;

    /* Post ownership — gates the Manage section + EditPostDialog */
    const isOwner = !!props.account && (data.author || {}).username === props.account;

    /* ── Favorites (Details → Actions → Add to favorites) ────────────────
     * Bookmark status lives in the LacertaDB favorites store (utils/
     * favorites.js, 'favorites' collection on api.settingsDb). Re-checked
     * whenever the displayed post changes, and kept live via subscribe()
     * so a removal from the FavoriteManagerDialog opened above this
     * dialog un-fills the row immediately. Index-only lookup — cheap. */
    useEffect(() => {
        const author = (data.author || {}).username;
        const permlink = data.permlink;
        if (!author || !permlink) { dispatch({ _is_favorite: false }); return; }
        let cancelled = false;
        const check = () => {
            favorites.isFavorite(props.api, favorites.FAVORITE_TYPES.ARTWORKS, author, permlink).then((value) => {
                if (cancelled || stateRef.current.data.permlink !== permlink) return;
                if (stateRef.current._is_favorite !== value) dispatch({ _is_favorite: value });
            }).catch(() => {});
        };
        check();
        const unsubscribe = favorites.subscribe(check);
        return () => { cancelled = true; unsubscribe(); };
    }, [data.permlink, data.author, props.api, dispatch]);

    /* Optimistic toggle: flip the row instantly, snapshot everything the
     * store needs from the already-hydrated post, revert on failure.
     * category/url gaps are back-filled from the chain by the store. */
    const toggleFavorite = useCallback(() => {
        const st = stateRef.current;
        const d = st.data || {};
        const author = (d.author || {}).username;
        const permlink = d.permlink;
        if (!author || !permlink) return;
        actions.trigger_sfx("state-change_confirm-down");
        if (st._is_favorite) {
            dispatch({ _is_favorite: false });
            favorites.removeFavorite(props.api, favorites.FAVORITE_TYPES.ARTWORKS, author, permlink).then((ok) => {
                if (!ok) dispatch({ _is_favorite: true });
                actions.trigger_snackbar(ok ? t("words.removed_from_favorites") : t("words.could_not_update_favorites"));
            });
        } else {
            dispatch({ _is_favorite: true });
            favorites.addFavorite(props.api, favorites.FAVORITE_TYPES.ARTWORKS, {
                author,
                author_name: (d.author || {}).name || author,
                author_image: (d.author || {}).image || "",
                permlink,
                title: d.title || "",
                image: d.image || null,
                width: (st.metadata && st.metadata.width) || (d.size && d.size.width) || 0,
                height: (st.metadata && st.metadata.height) || (d.size && d.size.height) || 0,
                description: d._summary || "",
                tags: d.tags || [],
                category: d.category || d.community || null,
                url: d.url || null,
                created: d.date || d.created || Date.now(),
            }).then((ok) => {
                if (!ok) dispatch({ _is_favorite: false });
                actions.trigger_snackbar(ok ? t("words.added_to_favorites") : t("words.could_not_update_favorites"));
            });
        }
    }, [props.api, dispatch]);

    /* PERF: useMemo for all derived render values — avoids recalculation
     * on every dispatch({}) that only touches animation flags. */
    const tab_value = useMemo(
        () => (_view_mobile_opened || !_view_right_mobile_enabled) ? _tab_value : 0,
        [_view_mobile_opened, _view_right_mobile_enabled, _tab_value]
    );

    const upVotesNumber = useMemo(
        () => (data.upVotesNumber || 0) + (_voted === 1 ? 1 : 0) - (_initialVoted === 1 ? 1 : 0),
        [data.upVotesNumber, _voted, _initialVoted]
    );

    const downVotesNumber = useMemo(
        () => (data.downVotesNumber || 0) + (_voted === -1 ? 1 : 0) - (_initialVoted === -1 ? 1 : 0),
        [data.downVotesNumber, _voted, _initialVoted]
    );

    const payout = useMemo(
        () => parseFloat((data.payout || "0$").replace("$", "")) || 0.0,
        [data.payout]
    );

    /* PERF: Stable bottom-bar style — only recalculated when mobile layout changes */
    const barStyle = useMemo(() => ({
        ...STYLE_BOTTOM_BAR_BASE,
        borderRadius: _view_right_mobile_enabled ? "24px 24px 0px 0px" : "42px",
        width: _view_right_mobile_enabled ? "100%" : "calc(100% - 16px)"
    }), [_view_right_mobile_enabled]);

    /* PERF: Stable _data for LicenseDialog — only recalculated when post changes */
    const _data = useMemo(
        () => ({ image: data.image, title: data.title, author: (data.author || {}).username }),
        [data.image, data.title, data.author]
    );

    /* PERF: Stable account image — avoids deep lookup on every render */
    const accountImage = useMemo(
        () => ((state._accounts || {})[props.account] || (state._authors || {})[props.account] || {}).image || "",
        [state._accounts, state._authors, props.account]
    );

    const dataAuthorUsername = (data.author || {}).username;

    /* PERF: Stable canvas style — only recalculated when size/renderer/zoom change */
    const canvasStyle = useMemo(() => ({
        ...STYLE_CANVAS_CONTEXT,
        width: _size.width * 2,
        height: _size.height * 2,
        borderRadius: (renderer === "xbrz" || renderer === "tri") ? `${128 / window.devicePixelRatio / zoom | 0}px` : "0px"
    }), [_size.width, _size.height, renderer, zoom]);

    const drawerClass =
        (_hidden2 && !inst.drawerHasAppeared) ? classes.viewRightPrerender
            : (_view_mobile_opened || !_view_right_mobile_enabled)
                ? (inst.drawerHasAppeared ? classes.viewRightNoAnim : classes.viewRight)
                : (inst.drawerHasAppeared ? classes.viewRightHiddenNoDelay : classes.viewRightHidden);

    const imageAnimClass =
        inst.navDismissing ? classes.dismiss
            : (inst.navBouncing && !_hidden) ? classes.bounceAppear
                : (inst.heroAnimating && !_hidden) ? classes.heroAppear
                    : (_hidden ? classes.hidden : classes.appear);

    /* PERF: Stable progress classes object for CircularProgress */
    const progressClasses = useMemo(() => ({ circle: classes.circle }), [classes.circle]);

    /* ================================================================
     * DELETED / UNAVAILABLE POST
     * ================================================================
     * The host page (Feed / FeedPersonal / Profile) opens this dialog
     * straight from the URL with a stub ({author, permlink, _loading})
     * and hydrates it afterwards, so the dialog has to be able to render
     * without a post. Three cases reach here, all of which previously
     * rendered an empty backdrop — a blank canvas and a drawer full of
     * undefined:
     *
     *   LOADING   — orphan fetch still in flight
     *   DELETED   — soft-deleted by its author (json_metadata.deleted; a
     *               pixel-art body is wiped to the literal "deleted"), or
     *               gone from the chain with the author still around
     *   NOT_FOUND — unresolvable link / api never came up
     *
     * Deleted posts are filtered out of every listing, so the only ways to
     * reach one are a shared link, the browser history and a stored
     * favorite — exactly the paths the user reported as blank.
     *
     * This sits AFTER every hook (rules of hooks) and deliberately does
     * NOT gate on `open`: a dialog closing on a deleted post keeps
     * rendering this tree, with open=false, so it fades out instead of
     * flashing the artwork layout on its way out.
     */
    const postState = getPostState(data);
    if (postState !== POST_STATE.READY) {
        const unavailableAuthor = data.author || {};
        const unavailableUsername = unavailableAuthor.username || "";
        const unavailableName = unavailableAuthor.name
            || (unavailableUsername ? "@" + unavailableUsername : "");
        const isDeleted = postState === POST_STATE.DELETED;

        return (
            <Portal>
                <Backdrop keepMounted={true} open={open} className={classes.backdrop}>
                    <IconButton className={classes.unavailableClose} onClick={onRequestClose}>
                        <CloseIcon />
                    </IconButton>
                    <div className={classes.unavailableWrap} onClick={onRequestClose}>
                        {postState === POST_STATE.LOADING ? (
                            <CircularProgress thickness={3} size={48} style={{ color: "#666" }} />
                        ) : (
                            <div className={classes.unavailableCard} onClick={(e) => e.stopPropagation()}>
                                {isDeleted
                                    ? <DeleteOutlineRounded className={classes.unavailableIcon} />
                                    : <InfoOutlined className={classes.unavailableIcon} />}

                                <Typography className={classes.unavailableTitle}>
                                    {isDeleted
                                        ? t("components.post_unavailable.deleted_title")
                                        : t("components.post_unavailable.not_found_title")}
                                </Typography>

                                {isDeleted && unavailableUsername && (
                                    <Tooltip arrow title={"@" + unavailableUsername}>
                                        <div className={classes.unavailableAuthorRow}
                                             onClick={() => openAuthor(unavailableUsername)}>
                                            <Avatar className={classes.unavailableAvatar}
                                                    src={unavailableAuthor.image}
                                                    imgProps={{ decoding: "async", loading: "lazy" }} />
                                            <span className={classes.unavailableAuthorName}>
                                                {t("components.post_unavailable.deleted_by", { author: unavailableName })}
                                            </span>
                                        </div>
                                    </Tooltip>
                                )}

                                <Typography className={classes.unavailableText}>
                                    {isDeleted
                                        ? t("components.post_unavailable.deleted_body")
                                        : t("components.post_unavailable.not_found_body")}
                                </Typography>

                                <Button className={classes.unavailableButton} onClick={onRequestClose}>
                                    {t("components.post_unavailable.back")}
                                </Button>
                            </div>
                        )}
                    </div>
                </Backdrop>
            </Portal>
        );
    }

    return (
        <Portal>
            <Backdrop keepMounted={true} open={open}
                      className={_closing ? `${classes.backdrop} ${classes.closingChrome}` : classes.backdrop}>
                <div style={STYLE_ROOT_CONTAINER}>
                    <div className={classes.viewLeft} ref={setViewRefCb}>
                        <div style={STYLE_CLOSE_OVERLAY} onClick={onRequestClose} />
                        <div style={STYLE_DOWNLOAD_WRAP} className={classes.downloadWrap}>
                            <IconButton onClick={downloadWithWatermark}><CloudDownload /></IconButton>
                            {_download_loading && <CircularProgress thickness={3} size={64} classes={progressClasses} className={classes.downloadButtonProgress} />}
                        </div>
                        {/* Arrows render only when the host page has a target in
                            that direction: availability runs the same blur-skipping
                            walk navigation uses, so a direction with nothing but
                            blurred cards left (or the list edge) hands `undefined`
                            and the arrow disappears — same convention as orphans. */}
                        {props.onPrevious && (
                            <Fade in timeout={900}>
                                <div className={classes.back} onClick={handleArrowPrev}>
                                    <ArrowForwardIosIcon style={STYLE_ARROW_PREV} className={classes.arrowIcon} />
                                </div>
                            </Fade>
                        )}
                        {props.onNext && (
                            <Fade in timeout={900}>
                                <div className={classes.forward} onClick={handleArrowNext}>
                                    <ArrowForwardIosIcon className={classes.arrowIcon} />
                                </div>
                            </Fade>
                        )}
                        <div ref={setImageRefCb}
                             style={{
                                 contain: "layout style", willChange: inst.dragging ? "transform" : "auto",
                                 position: "fixed",
                                 transform: `translate3d(calc(${inst.posLeft}px - 50%), calc(${inst.posTop}px - 50%), 0) scale(${(inst.currentZoom / 3).toFixed(4)})`,
                                 transformOrigin: "50% 50%",
                                 userSelect: "none", touchAction: "none", pointerEvents: "none",
                                 cursor: inst.dragging ? "grabbing" : "grab",
                             }}>
                            <div ref={setInnerRefCb} className={imageAnimClass} style={STYLE_IMG_ANIM_INNER}>
                                {/* Blur backplate: src is set imperatively by the canvas
                                    reveal step (see setImgd) so it swaps atomically with
                                    the canvas pixels. Driving it through React diff caused
                                    a 1–3 frame flash where the blur showed the new post
                                    but the canvas still held the previous one. */}
                                <img ref={setBlur1RefCb} decoding="async" style={STYLE_BLUR_1} alt="" />
                                <img ref={setBlur2RefCb} decoding="async" style={STYLE_BLUR_2} alt="" />
                                <canvas onContextMenu={PREVENT_CONTEXT}
                                        className={renderer === "square" ? "pixelated" : ""}
                                        ref={setCanvasRefCb}
                                        style={canvasStyle} />
                            </div>
                        </div>
                    </div>
                    {<div className={drawerClass}>
                        <DrawerCardInner
                            classes={classes} open={open}
                            _view_mobile_opened={_view_mobile_opened} _view_right_mobile_enabled={_view_right_mobile_enabled}
                            data={data} _hidden2={_hidden2} locales={locales}
                            openAuthorFromData={openAuthorFromData} menuToggle={menuToggle}
                            tab_value={tab_value} handleTabChange={handleTabChange} handleChangeIndex={handleChangeIndex}
                            metadata={metadata} type={type} kb={kb} _copied={_copied}
                            handleTagClick={handleTagClick} handleDownloadArtwork={handleDownloadArtwork}
                            handleOpenLicenseDialog={handleOpenLicenseDialog} handleCopy={handleCopy}
                            isOwner={isOwner} openEditPost={openEditPost}
                            isFavorite={_is_favorite} onToggleFavorite={toggleFavorite}
                            _current_comments={_current_comments} _show_parent={_show_parent}
                            _sorting={_sorting} sortedComments={sortedComments} _comments_loading={_comments_loading}
                            api={props.api} account={props.account}
                            toggleShowParent={toggleShowParent} sliceReplies={sliceReplies}
                            handleSortingChange={handleSortingChange} showReplies={showReplies} onLoadReplies={loadRepliesFor}
                            openAuthor={openAuthor} replyToComment={replyToComment}
                            startEditComment={startEditComment} requestDeleteComment={requestDeleteComment}
                            focusKey={_focusComment ? (_focusComment.author + "/" + _focusComment.permlink) : null}
                            focusPathKeys={_focusPathKeys}
                            authorsEntries={authorsEntries} votesRenderer={votesRenderer}
                            barStyle={barStyle} payout={payout}
                            upVotesNumber={upVotesNumber} downVotesNumber={downVotesNumber}
                            _voted={_voted} _upvoteLoading={_upvoteLoading} _downvoteLoading={_downvoteLoading}
                            upvoteToggle={upvoteToggle} downvoteToggle={downvoteToggle}
                            triggerPositiveVotes={triggerPositiveVotes} triggerNegativeVotes={triggerNegativeVotes}
                            _reply_target={_reply_target} _edit_target={_edit_target} _comment_sending={_comment_sending}
                            accountImage={accountImage} dataAuthorUsername={dataAuthorUsername}
                            clearReplyTarget={clearReplyTarget} cancelEditComment={cancelEditComment}
                            submitComment={submitComment} onCommentKeyDown={onCommentKeyDown}
                            setMenuCardRefCb={setMenuCardRefCb} />
                    </div>}
                </div>
                <LicenseDialog open={_license_dialog_opened} onClose={closeLicenseDialog}
                               licenseBase={_license_base} customization={_license_customization} data={_data} />
                {/* Post metadata editor — owner only (Manage → Edit post details) */}
                {isOwner && (
                    <EditPostDialog
                        open={_edit_post_open}
                        onClose={closeEditPost}
                        api={props.api}
                        account={props.account}
                        data={data}
                        onUpdated={handlePostEdited}
                    />
                )}
                {/* Delete-own-comment confirmation (delete_comment broadcast) */}
                <DeleteCommentModal
                    open={Boolean(_delete_target)}
                    api={props.api}
                    account={props.account}
                    comment={_delete_target}
                    onCancel={cancelDeleteComment}
                    onDeleted={handleCommentDeleted}
                />
                {_download_ready && (
                    <Fade in timeout={250}>
                        <div className={classes.downloadOverlay} onClick={cancelDownload}>
                            <div className={classes.downloadOverlayInner}
                                 onClick={(e) => { e.stopPropagation(); confirmDownload(); }}>
                                <Fade in timeout={400} style={{ transitionDelay: "300ms" }}>
                                    <CloudDownload className={classes.downloadOverlayIcon} />
                                </Fade>
                                <Fade in timeout={400} style={{ transitionDelay: "600ms" }}>
                                    <span className={classes.downloadOverlayText}>{_download_ready.filename}</span>
                                </Fade>
                            </div>
                        </div>
                    </Fade>
                )}
            </Backdrop>
        </Portal>
    );
}

export default withStyles(styles)(PostDialog);