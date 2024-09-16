import * as React from "preact/compat";
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
import {Colors, Color} from "simdope";
import Avatar from "@material-ui/core/Avatar";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import CloseIcon from "@material-ui/icons/Close";
import CardHeader from "@material-ui/core/CardHeader";
import timeAgo from "../utils/TimeAgo";
import ChevronRightCircleOutlined from "../icons/ChevronRightCircleOutlined";
import PixaSupra from "../icons/PixaSupra";
import AutoSizer from '@pixagram/virtualized/dist/es/AutoSizer';
import VirtualizedList from '@pixagram/virtualized/dist/es/List';
import {crtF, hexF, sqrF, xbrzF} from "../utils/render-pool";

import ArrowForwardIosIcon from "@material-ui/icons/ArrowForwardIos";
import InfoOutlined from "@material-ui/icons/InfoOutlined";
import JSLoader from "../utils/JSLoader";
import {HISTORY} from "../utils/constants";
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
import {safeHTML, sanitizeComment as rawSanitizeComment} from "../utils/api/sanitizer";
import CloudDownload from "@material-ui/icons/CloudDownload";
import CommentRounded from "@material-ui/icons/CommentRounded";
import DescriptionRounded from "@material-ui/icons/DescriptionRounded";
import LabelRounded from "@material-ui/icons/LabelRounded";
import SendRounded from "@material-ui/icons/SendRounded";
import VisibilityRounded from "@material-ui/icons/VisibilityRounded";
import VisibilityOffRounded from "@material-ui/icons/VisibilityOffRounded";
import CircularProgress from "@material-ui/core/CircularProgress";
import CommentInList from "./CommentInList";
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
import HandCoin from "../icons/HandCoin";
import ChevronRightRounded from "@material-ui/icons/ChevronRightRounded";
import FolderSpecialRounded from "@material-ui/icons/FolderSpecialRounded";
import PrintRounded from "@material-ui/icons/PrintRounded";
import SecurityRounded from "@material-ui/icons/SecurityRounded";
import ShareRounded from "@material-ui/icons/ShareRounded";
import SupervisedUserCircle from "@material-ui/icons/SupervisedUserCircle";
import PaperCardActions from "./PaperCardActions";
import { analyze_colors } from 'smart-downscaler';

import { pngdby } from "../utils/png-db";

async function getMetadata(src){
    if(!src) return null;

    const imgOBJ = await pngdby.get_new_img_obj(src);
    const imgd = await pngdby.get_new_img_data(imgOBJ);
    const r = analyze_colors(imgd.data, 256, "hilbert");

    return {
        imgd,
        colors: r.to_json(),
        width: imgd.width,
        height: imgd.height
    };
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

const ParentComment = React.memo(({ comment, index, classes, locales, onOpenAuthor }) => (
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
                <span>{timeAgo.format(comment.date || Date.now())}</span>
            </Tooltip>
        </Typography>
        <Typography
            component="div"
            variant="body1"
            color="textSecondary"
            style={{ lineHeight: "1rem", letterSpacing: 0 }}
            dangerouslySetInnerHTML={{ __html: safeHTML(comment.body) }}
        />
    </div>
));

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
                        For Sale
                    </Typography>
                </div>
            ) : edition.soldPrice ? (
                <div>
                    <Typography variant="body2" style={{ color: "#888" }}>
                        Last: {edition.soldPrice} {currency}
                    </Typography>
                    <Typography variant="caption" style={{ color: "#666" }}>
                        {timeAgo.format(edition.soldDate)}
                    </Typography>
                </div>
            ) : (
                <Typography variant="body2" style={{ color: "#666" }}>
                    Not for sale
                </Typography>
            )}
        </div>
    </div>
));

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
                    {timeAgo.format(event.date || Date.now())}
                </Typography>
            </div>
            <Typography variant="caption" style={{ color: "#888" }}>
                {event.type === "minted" ? "Minted editions" :
                    event.type === "transfer" ? `Transferred edition #${event.edition}` :
                        `Purchased edition #${event.edition}`}
                {event.price > 0 && ` for ${event.price} ${currency}`}
            </Typography>
        </div>
    </div>
));

const CollectionItem = React.memo(({ collection }) => (
    <ListItem key={collection.id} button style={{ borderRadius: 8 }}>
        <ListItemIcon>
            <FolderSpecialRounded style={{ color: "#666" }} />
        </ListItemIcon>
        <ListItemText
            primary={collection.name}
            secondary={`${collection.count} items • Floor: ${collection.floorPrice} ${currency}`}
        />
        <ChevronRightRounded style={{ color: "#444" }} />
    </ListItem>
), (a, b) => a.id === b.id);

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
                                    onCopy
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
            <ListSubheader disableSticky>Image</ListSubheader>
            <ListItem>
                <ListItemIcon><SwapHoriz /></ListItemIcon>
                <ListItemText>{metadata.width}px Width</ListItemText>
            </ListItem>
            <ListItem>
                <ListItemIcon><SwapVert /></ListItemIcon>
                <ListItemText>{metadata.height}px Height</ListItemText>
            </ListItem>
            <ListItem>
                <ListItemIcon><Palette /></ListItemIcon>
                <ListItemText>{(metadata.colors || []).length} Colors</ListItemText>
            </ListItem>
            <div className={classes.colorBadges}>
                {(metadata.colors || []).map((o) => (
                    <ColorBadge key={o.hex} color={o} classes={classes} />
                ))}
            </div>
            <ListSubheader disableSticky>Artwork</ListSubheader>
            <Tooltip title="Download the original image">
                <ListItem onClick={onDownloadArtwork} style={{ cursor: "pointer" }}>
                    <ListItemIcon><Info /></ListItemIcon>
                    <ListItemText>{type.toUpperCase()} of {kb.toFixed(2)} kB</ListItemText>
                </ListItem>
            </Tooltip>
            <Tooltip title="View the artwork's license">
                <ListItem onClick={onOpenLicenseDialog} style={{ cursor: "pointer" }}>
                    <ListItemIcon><License /></ListItemIcon>
                    <ListItemText>PIXA LICENSE 1.0</ListItemText>
                </ListItem>
            </Tooltip>
            <ListSubheader disableSticky>Share</ListSubheader>
            <Tooltip title="Copy the link and past it on another social media">
                <FormControl className={classes.urlLink} variant="filled" style={{width: "100%"}}>
                    <InputLabel htmlFor="filled-adornment-copy">Current URL</InputLabel>
                    <FilledInput
                        id="filled-adornment-copy"
                        type={'text'}
                        fullWidth
                        value={window.location.href}
                        endAdornment={
                            <InputAdornment position="end">
                                <Tooltip title={"Copy the link to the clipboard"}>
                                    <IconButton
                                        aria-label="copy text url"
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
        </List>
    </React.Fragment>
), function (a, b){return a.id === b.id; });

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
                                     onToggleShowParent,
                                     onSliceReplies,
                                     onSortingChange,
                                     onShowReplies,
                                     onOpenAuthor,
                                     onReply
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
                        }}>Reply To</FormLabel>
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
            }}>Sort By</FormLabel>
            <RadioGroup
                value={sorting}
                defaultValue={"Hype"}
                onChange={onSortingChange}
                row
                aria-label="sorting"
                name="sorting"
                style={{ justifyContent: "end", float: "right" }}
            >
                {["Hype", "Votes", "Age"].map((label) => (
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
                        No comments yet
                    </Typography>
                    <Typography variant="body2" style={{ color: "#444" }}>
                        Be the first to share your thoughts!
                    </Typography>
                </div>
            ) : comments.map((comment, id) => (
                <CommentInList
                    id={id}
                    key={id}
                    data={comment}
                    api={api}
                    account={account}
                    onShowReplies={(comment) => onShowReplies(comment)}
                    onReply={(comment) => onReply(comment)}
                />
            ))}
        </List>
    </div>
), function (a, b){
    /* OPT #17: Shallow comparison instead of JSON.stringify */
    if (a.id !== b.id || a.sorting !== b.sorting || a.showParent !== b.showParent || a.commentsLoading !== b.commentsLoading) return false;
    if (a.api !== b.api || a.account !== b.account) return false;
    if (a.comments !== b.comments) return false;
    if (a.currentComments === b.currentComments) return true;
    if (a.currentComments.length !== b.currentComments.length) return false;
    for (let i = 0; i < a.currentComments.length; i++) {
        if (a.currentComments[i] !== b.currentComments[i]) return false;
    }
    return true;
});

const NFTView = React.memo(({ id, data }) => (
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
                        <Typography variant="h6" style={{ color: "#fff", fontWeight: "bold", marginBottom: 8 }}>
                            NFT #{String(data.id||"08374393").substring(0, 8) || "A1B2C3D4"}
                        </Typography>
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
                                    Floor Price
                                </Typography>
                                <Typography variant="body2" style={{ color: "#fff", fontWeight: "bold" }}>
                                    {floorPrice ? `${floorPrice} ${currency}` : "No offers"}
                                </Typography>
                            </div>
                            <div>
                                <Typography variant="caption" style={{ color: "#888", display: "block" }}>
                                    Last Sale
                                </Typography>
                                <Typography variant="body2" style={{ color: "#fff", fontWeight: "bold" }}>
                                    {lastSalePrice ? `${lastSalePrice} ${currency}` : "—"}
                                </Typography>
                            </div>
                            <div>
                                <Typography variant="caption" style={{ color: "#888", display: "block" }}>
                                    Available
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
                            Available Editions
                        </Typography>
                        <Typography variant="body2" style={{ color: "#ffffff" }}>
                            {availableEditions.length} for sale
                        </Typography>
                    </div>

                    <div style={{
                        backgroundColor: "#0f0f0f",
                        borderRadius: 8,
                        padding: 16,
                        marginBottom: 16
                    }}>
                        <Typography variant="caption" style={{ color: "#ffffff", fontWeight: "bold" }}>
                            BEST PRICE
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
                    >
                        Buy Now • {floorPrice} {currency}
                    </Button>

                    <Button
                        variant="outlined"
                        fullWidth
                        style={{
                            borderColor: "#666",
                            color: "#fff"
                        }}
                    >
                        View All {availableEditions.length} Available
                    </Button>
                </CardContent>
            </Card>
        ) : (
            <Card style={{ backgroundColor: "#0f0f0f", marginBottom: 20, borderRadius: 12 }}>
                <CardContent>
                    <Typography variant="subtitle1" style={{ color: "#fff", fontWeight: "bold", marginBottom: 16 }}>
                        No Editions For Sale
                    </Typography>

                    <div style={{ textAlign: "center", padding: "20px 0" }}>
                        <Typography variant="body1" style={{ color: "#888", marginBottom: 16 }}>
                            All {maxEditions} editions are currently held by collectors
                        </Typography>

                        {avgSalePrice > 0 && (
                            <Typography variant="body2" style={{ color: "#666", marginBottom: 20 }}>
                                Average sale price: {avgSalePrice.toFixed(0)} {currency}
                            </Typography>
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
                        Make Collection Offer
                    </Button>
                </CardContent>
            </Card>
        )}

        {/* All Editions */}
        <Card style={{ backgroundColor: "#1a1a1a", marginBottom: 20, borderRadius: 12 }}>
            <CardContent>
                <Typography variant="subtitle1" style={{ color: "#fff", fontWeight: "bold", marginBottom: 16 }}>
                    All Editions
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
                    Ownership History
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
                    Collections
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
                        <ListItemText primary="Share" />
                    </ListItem>
                    <ListItem button style={{ borderRadius: 8 }}>
                        <ListItemIcon><PrintRounded style={{ color: "#666" }} /></ListItemIcon>
                        <ListItemText primary="Print" />
                    </ListItem>
                    <ListItem button style={{ borderRadius: 8 }}>
                        <ListItemIcon><SecurityRounded style={{ color: "#666" }} /></ListItemIcon>
                        <ListItemText primary="Report" />
                    </ListItem>
                </List>
            </CardContent>
        </Card>
    </div>
), function (a, b){return a.id === b.id; });

/* ──────────────────────────────────────────────────────────────────────
 * PERF: Hoisted constant style objects — created once, reused every render.
 * Avoids allocating new objects on every forceUpdate / render cycle.
 * ────────────────────────────────────────────────────────────────────── */
const STYLE_ROOT_CONTAINER = Object.freeze({ userSelect: "none", width: "100%", height: "100%", display: "flex", overflow: "hidden", contain: "size style layout" });
const STYLE_CLOSE_OVERLAY = Object.freeze({ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" });
const STYLE_DOWNLOAD_WRAP = Object.freeze({ zIndex: 1, top: 12, left: 12, position: "absolute", margin: "12px", display: "relative" });
const STYLE_ARROW_PREV = Object.freeze({ transform: "rotate(180deg)" });
const STYLE_IMG_ANIM_INNER = Object.freeze({ userSelect: "none", touchAction: "none", pointerEvents: "none", transformOrigin: "50% 50%" });
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

/* PERF: Stable callbacks for VirtualizedList — avoids new function allocation per render */
const NOOP = () => {};

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
        },
        "& .MuiCardHeader-title": {
            fontWeight: "bold",
            fontFamily: '"Industry Book", "Normative Pro"',
            color: "#fff",
            cursor: "pointer",
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
        width: "calc(100% - 480px)",
        position: "inherit",
        contain: "layout style size",
        transform: "translateZ(0px)",
        zIndex: -1,
        [theme.breakpoints.down("sm")]: {
            width: "100%",
        }
    },
    viewRight: {
        width: "480px",
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
        width: "480px",
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
        width: "480px",
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
        width: "480px",
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
        width: "480px",
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
            margin: "0px !important"
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
        contain: "style layout",
        transition: "height 240ms cubic-bezier(0.4, 0, 0.2, 1) 0ms !important",
        height: "0px !important",
        "&.MuiCollapse-entered": {
            height: "160px !important",
            transition: "height 120ms cubic-bezier(0.4, 0, 0.2, 1) 0ms !important"
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
});

class PostDialog extends React.PureComponent {

    constructor(props) {
        super(props);
        this.st4te = {
            classes: props.classes,
            keepMounted: props.keepMounted || false,
            open: props.open || false,
            data: props.data,
            renderer: props.renderer,
            mode: props.mode,
            locales: props.locales,
            kb: 0,
            type: "",
            _history: HISTORY,
            _authors: [],
            _sorting: "Hype",
            _tab_value: 0,
            _view_element: null,
            _image_element_ref: null,
            _view_element_measurement: {},
            _image_element_ref_measurement: {},
            _canvas: null,
            _size: {},
            _card_ref: null,
            _download_loading: false,
            _hidden: true,
            _hidden2: true,
            _zoom_mode: 0,
            _view_mobile_opened: false,
            _view_right_mobile_enabled: (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960,
            /* OPT #5: Position/zoom kept in st4te for render, but drag intermediates moved to instance vars */
            position: {left: 0, top: 0},
            zoom: 1.33,
            metadata: {
                imgd: null,
                colors: [],
                width: 0,
                height: 0,
            },
            _copied: false,
            _voted: 0,
            _initialVoted: 0,
            _upvoteLoading: false,
            _downvoteLoading: false,
            api: props.api || null,
            account: props.account || null,
            _license_dialog_opened: false,
            _license_base: baseLicenseData,
            _license_customization: null,
            _accounts: {},
            _comments: [],
            _current_comments: [],
            _show_parent: false,
            _comments_loading: false,
            _comment_sending: false,
            _reply_target: null
        };

        this._drawerSettings = {
            hysteresisClosed: 14,
            hysteresisOpened: 18,
            friction: 0.0333
        };

        // Render tracking
        this._currentRenderId = 0;
        this._pendingRenderAbort = null;

        /* ======================================================================
         * OPT #5: Transient drag/gesture state as instance properties
         * These never need to trigger a render, so they bypass st4te entirely.
         * ====================================================================== */
        // Canvas image drag state
        this._dragging = false;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragOriginLeft = 0;
        this._dragOriginTop = 0;
        this._posLeft = 0;
        this._posTop = 0;
        this._currentZoom = 1.33;
        this._rafDragId = null;
        this._pendingDx = 0;
        this._pendingDy = 0;

        // Card (menu) drag state
        this._cardDragging = false;
        this._cardYStart = 0;
        this._cardXStart = 0;
        this._cardYOffset = 0;
        this._rafCardId = null;
        this._pendingCardOffset = 0;
        this._cardPointerId = null;
        this._cardIsHidden = true;
        this._cardWrapperEl = null;
        /* FIX: Manual scroll state for opened drawer */
        this._cardScrolling = false;
        this._cardActiveScrollable = null;
        this._lastPointerY = 0;
        this._scrollVelocity = 0;
        this._scrollMomentumRaf = null;

        // Pinch zoom state
        this._pinchStartDist = null;
        this._startZoom = 1.33;
        this._twoPointer = false;
        this._twoPointerTimeout = null;

        // Wheel throttle
        this._rafWheelId = null;
        this._pendingWheelEvent = null;

        // Resize throttle
        this._resizeRaf = null;

        // Cached rect (OPT #8)
        this._cachedImageRect = null;
        this._cachedImageRectDirty = true;

        // Hero animation state
        this._heroAnimating = false;
        this._originRect = null;
        this._heroTransitionTimer = null;
        this._positionSetForId = null; // Track which artwork ID has had position set
        this._drawerHasAppeared = false; // Track whether drawer slide-in has played

        // Arrow nav transition state
        this._navTransitioning = false;
        this._navDismissing = false;
        this._navBouncing = false;
        this._navDirection = null;
        this._navDismissTimer = null;
        this._navBounceTimer = null;

        /* OPT #16: Pre-bind all handlers in constructor (no .bind in addEventListener loops) */
        this._handleTagClick = this._set_tag_naviguation.bind(this);
        this._handleDownloadArtwork = this._download_artwork.bind(this);
        this._handleOpenLicenseDialog = this._handle_open_license_dialog.bind(this);
        this._handleCopy = this._copy.bind(this);
        this._handleToggleShowParent = this._toggle_show_parent.bind(this);
        this._handleSliceReplies = this._slice_replies.bind(this);
        this._handleSortingChange = this._handle_sorting_change.bind(this);
        this._handleShowReplies = this._show_replies.bind(this);
        this._handleOpenAuthor = this._open_author.bind(this);
        this._handleSubmitComment = this._submit_comment.bind(this);
        this._handleReplyToComment = this._reply_to_comment.bind(this);
        this._commentRefreshTimer = null;

        /* OPT #16: Pre-bound event handlers for view and card */
        this._bound_handle_wheel = this._handle_wheel.bind(this);
        this._bound_handle_pointer_down = this._handle_view_pointer_down.bind(this);
        this._bound_handle_pointer_move = this._handle_view_pointer_move.bind(this);
        this._bound_handle_pointer_up = this._handle_view_pointer_up.bind(this);
        this._bound_handle_card_pointer_down = this._handle_card_pointer_down.bind(this);
        this._bound_handle_card_pointer_move = this._handle_card_pointer_move.bind(this);
        this._bound_handle_card_pointer_up = this._handle_card_pointer_up.bind(this);
        this._bound_computeSize = this._debouncedComputeSize.bind(this);

        /* PERF #4: Cache event tuples — avoid re-creating arrays on each add/remove call */
        this._viewEventsCache = null;
        this._cardEventsCache = null;

        /* PERF #5: Cache authors entries array for VirtualizedList */
        this._authorsEntriesCache = null;
        this._authorsEntriesCacheRef = null;

        /* PERF #6: Memoize _get_views output */
        this._cachedViews = null;
        this._cachedViewsKey = null;

        /* PERF #7: Cache sorted comments */
        this._sortedCommentsCache = null;
        this._sortedCommentsCacheKey = null;

        /* PERF: onContextMenu handler cached */
        this._bound_preventContextMenu = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };

        /* PERF #21: Pre-bound render handlers — avoid arrow function allocation per render */
        this._bound_openAuthorFromData = () => { this._open_author((this.st4te.data?.author || {}).username); };
        this._bound_menuToggle = () => {
            if (this.st4te._view_mobile_opened || !this.st4te._view_right_mobile_enabled) {
                this._set_menu_close();
            } else {
                this._set_menu_open();
            }
        };
        this._bound_clearReplyTarget = () => {
            this.setSt4te({ _reply_target: null }, () => { this.forceUpdate(); });
        };
        this._bound_onChangeIndex = (v) => this._handleTabChange({}, v);

        /* PERF #21: Swipeable view scroll target cache */
        this._swipeableScrollTarget = null;
    }

    setSt4te(st4te, callback) {
        "use strict";
        /* PERF #17: for...in avoids Object.keys() allocation.
         * The toString() and bitwise coercions were unnecessary overhead. */
        for (const key in st4te) {
            if (st4te.hasOwnProperty(key)) {
                this.st4te[key] = st4te[key];
            }
        }

        if (callback) {
            callback();
        }
    }

    componentWillReceiveProps(new_props) {
        const isNewImage = new_props.data.image !== this.st4te.data.image;
        const isNewlyClosed = new_props.open === null && this.st4te.open !== null;
        const isNewPost = (new_props.data.id !== this.st4te.data.id) || isNewImage;
        const kb = ((new_props.data.image || "").length || 0) / 1000 * 3 / 4;
        const type = (new_props.data.image || "").startsWith("data:image/png;base64,")
            ? "png"
            : (new_props.data.image || "").startsWith("data:image/webp;base64,")
                ? "webp"
                : "unknown";

        // Cancel any pending render when image changes
        if (isNewImage || isNewlyClosed) {
            this._currentRenderId++;
            this._clearCanvas();
            this._cachedImageRectDirty = true; /* OPT #8 */
            // Stop comment auto-refresh when closing
            if (this._commentRefreshTimer) {
                clearInterval(this._commentRefreshTimer);
                this._commentRefreshTimer = null;
            }
            // Reset nav transition state on close
            if (isNewlyClosed) {
                this._navTransitioning = false;
                this._navDismissing = false;
                this._navBouncing = false;
                this._navDirection = null;
                this._positionSetForId = null;
                this._drawerHasAppeared = false;
                if (this._navDismissTimer) { clearTimeout(this._navDismissTimer); this._navDismissTimer = null; }
                if (this._navBounceTimer) { clearTimeout(this._navBounceTimer); this._navBounceTimer = null; }
            }
        }

        // Sync api and account from parent
        const extraState = {};
        if (new_props.api !== undefined) extraState.api = new_props.api;
        if (new_props.account !== undefined) extraState.account = new_props.account;
        const accountChanged = new_props.account && new_props.account !== this.st4te.account;

        // Resolve the current user's vote when opening a new post
        if (isNewPost) {
            const initialVoted = this._resolve_initial_voted(new_props.data, new_props.account || this.st4te.account);
            extraState._initialVoted = initialVoted;
            extraState._voted = initialVoted;
            extraState._comments = [];
            extraState._current_comments = [];
            extraState._comments_loading = false;
            extraState._comment_sending = false;
            extraState._reply_target = null;
            /* PERF #18: Invalidate memoization caches on new post */
            this._cachedViews = null;
            this._cachedViewsKey = null;
            this._sortedCommentsCache = null;
            this._sortedCommentsCacheKey = null;
            this._sortedCommentsCacheRef = null;
        }
        // Sync vote state when same post's data was updated externally (e.g. PaperCard voted)
        else if (new_props.data.active_votes !== this.st4te.data.active_votes) {
            const initialVoted = this._resolve_initial_voted(new_props.data, new_props.account || this.st4te.account);
            extraState._initialVoted = initialVoted;
            extraState._voted = initialVoted;
        }

        this.setSt4te({ ...new_props, kb, type, ...extraState }, () => {
            // Capture origin rect for hero animation (skip during arrow nav — bounce handles that)
            if (isNewPost && !this._navTransitioning && new_props.originRect && new_props.originRect.width > 0) {
                this._originRect = new_props.originRect;
                this._heroAnimating = true;
                this._positionSetForId = null; // Reset so new position is computed
                this._drawerHasAppeared = false; // Reset so drawer slides in after hero
            } else if (isNewPost) {
                this._originRect = null;
                this._heroAnimating = false;
                this._positionSetForId = null; // Reset so new position is computed
                // During arrow nav, keep drawerHasAppeared=true so drawer doesn't re-animate
                if (!this._navTransitioning) {
                    this._drawerHasAppeared = false;
                }
            }
            if (isNewPost) {
                this._fetch_comments();
            }

            if (accountChanged) {
                this._cache_own_profile();
            }

            if (isNewlyClosed || isNewImage) {
                // During arrow nav, preserve drawer state (tab, content visibility)
                const preserveDrawer = this._navTransitioning || this._navBouncing;
                this.setSt4te({
                    _tab_value: preserveDrawer ? this.st4te._tab_value : 0,
                    _hidden: true,
                    _hidden2: preserveDrawer ? false : true,
                    _copied: false,
                    init_pos: isNewlyClosed ? new_props.open : null,
                    metadata: {
                        imgd: null,
                        colors: [],
                        width: 0,
                        height: 0,
                    }
                }, () => {
                    this.forceUpdate();
                });
            }

            if (isNewImage) {
                const renderId = this._currentRenderId;

                requestAnimationFrame(() => {
                    if (renderId !== this._currentRenderId) return;

                    getMetadata(new_props.data.image)
                        .then((result) => {
                            if (renderId !== this._currentRenderId) return;

                            this.setSt4te({
                                metadata: result,
                                zoom: 1.33,
                                _hidden2: false
                            }, () => {
                                this._currentZoom = 1.33; /* OPT #5: sync instance var */
                                this._get_views(true);
                                this._computeSize();
                            });
                        })
                        .catch(() => {});
                });
            }
        });
    }

    /* OPT #1: Direct DOM mutation for position updates — no state involved */
    /* PERF #8: translate3d promotes to GPU composite layer */
    _applyImageTransform = () => {
        const el = this.st4te._image_element_ref;
        if (!el || !el.style) return;
        el.style.transform =
            `translate3d(calc(${this._posLeft}px - 50%), calc(${this._posTop}px - 50%), 0) scale(${(this._currentZoom / 3).toFixed(4)})`;
    }

    forceUpdatePosition = () => {
        this._applyImageTransform();
    }

    swipeableViewScrollTop = () => {
        /* PERF #20: Cache the scroll target element */
        if (!this._swipeableScrollTarget || !this._swipeableScrollTarget.isConnected) {
            const views = document.getElementsByClassName("react-swipeable-view-container");
            const view = views.item(0);
            if (!view) return;
            this._swipeableScrollTarget = view.children.item(0);
            if (!this._swipeableScrollTarget) return;
        }
        this._swipeableScrollTarget.style.scrollBehavior = "smooth";
        this._swipeableScrollTarget.scrollTop = 0;
    };

    componentDidMount() {
        JSLoader(() => import("../data/authors")).then((d1) => {
            const authors = d1.default();
            let comments = this.st4te._comments;
            comments = comments.map((comment) => {
                return { ...comment, author: authors[comment.username] || { username: comment.username, name: comment.username, image: "" } };
            })
            this.setSt4te({ _authors: authors, _comments: comments }, () => {
                // Fetch real comments from API once authors are loaded
                this._fetch_comments();
                // Pre-fetch logged-in user's profile for optimistic comment avatars
                this._cache_own_profile();
            });
        });

        /* OPT #11: Debounced resize handler via rAF */
        /* PERF #20: passive:true since we never preventDefault in resize */
        window.addEventListener("resize", this._bound_computeSize, { passive: true });

        /* OPT #13: Removed setInterval two_pointer guard.
         * Two-pointer state is now reset in pointer-up with a proper timeout. */
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this._bound_computeSize);

        /* Clear comment auto-refresh timer */
        if (this._commentRefreshTimer) {
            clearInterval(this._commentRefreshTimer);
            this._commentRefreshTimer = null;
        }

        /* OPT #13: Clear two-pointer timeout */
        if (this._twoPointerTimeout) {
            clearTimeout(this._twoPointerTimeout);
            this._twoPointerTimeout = null;
        }

        /* Cancel any pending rAF */
        if (this._rafDragId) cancelAnimationFrame(this._rafDragId);
        if (this._rafCardId) cancelAnimationFrame(this._rafCardId);
        if (this._rafWheelId) cancelAnimationFrame(this._rafWheelId);
        if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
        if (this._heroTransitionTimer) clearTimeout(this._heroTransitionTimer);
        if (this._navDismissTimer) clearTimeout(this._navDismissTimer);
        if (this._navBounceTimer) clearTimeout(this._navBounceTimer);

        /* OPT #16: Pre-bound handlers allow proper removal */
        if (this.st4te._view_element) {
            this._getViewEvents().forEach(([event, handler]) => {
                this.st4te._view_element.removeEventListener(event, handler, { passive: true });
            });
        }
    }

    _copy = (s) => {
        clipboard.writeText(s);
        this.setSt4te({ _copied: true }, () => {
            this.forceUpdate(() => {
                actions.trigger_snackbar("The URL has been copied!");

                setTimeout(() => {
                    try {
                        this.setSt4te({ _copied: false }, () => {
                            this.forceUpdate();
                        });
                    } catch (e) { }
                }, 5000)
            });
        });
    };

    _handleTabChange = (e, value) => {
        this.setSt4te({ _tab_value: value }, () => {
            this.swipeableViewScrollTop();
            this.forceUpdate();
        })
    }

    /* PERF #5: Cache entries array — avoid Object.entries() on every row render */
    _getAuthorsEntries = () => {
        const authors = this.st4te._authors;
        if (this._authorsEntriesCacheRef !== authors) {
            this._authorsEntriesCacheRef = authors;
            this._authorsEntriesCache = Object.entries(authors);
        }
        return this._authorsEntriesCache;
    }

    _votesRenderer = ({ index, key, style }) => {
        const entries = this._getAuthorsEntries();
        const author = entries[index][1];
        return (
            <ListItem className={styles.row} key={key} style={style}>
                <ListItemAvatar>
                    <Tooltip title={`@${author.username}`}>
                        <Avatar src={author.image} style={{ borderRadius: "12px", cursor: "pointer" }} className={"pixelated"} onClick={() => { this._open_author(author.username) }}></Avatar>
                    </Tooltip>
                </ListItemAvatar>
                <ListItemText primary={author.name} secondary={`0.1 PS with 100%`} />
            </ListItem>
        );
    }

    /* OPT #20: Unified Pointer Events only — dropped separate touch* handlers.
     * Pointer Events API handles mouse, touch, and pen natively. */
    /* PERF #4: Cached — array is built once, reused on every add/remove cycle */
    _getViewEvents = () => {
        if (!this._viewEventsCache) {
            this._viewEventsCache = [
                ["wheel", this._bound_handle_wheel],
                ["pointerdown", this._bound_handle_pointer_down],
                ["pointermove", this._bound_handle_pointer_move],
                ["pointerup", this._bound_handle_pointer_up],
                ["pointercancel", this._bound_handle_pointer_up],
                ["pointerleave", this._bound_handle_pointer_up]
            ];
        }
        return this._viewEventsCache;
    }

    _getCardEvents = () => {
        /* FIX: Removed pointerleave — setPointerCapture ensures all events
         * route to the card during active drag regardless of pointer position. */
        if (!this._cardEventsCache) {
            this._cardEventsCache = [
                ["pointerdown", this._bound_handle_card_pointer_down],
                ["pointermove", this._bound_handle_card_pointer_move],
                ["pointerup", this._bound_handle_card_pointer_up],
                ["pointercancel", this._bound_handle_card_pointer_up]
            ];
        }
        return this._cardEventsCache;
    }

    _setViewRef = (element) => {
        if (element) {
            if (typeof element.getBoundingClientRect === "function") {
                this.setSt4te({ _view_element: element }, () => {
                    /* OPT #16: Use pre-bound handlers */
                    this._getViewEvents().forEach(([event, handler]) => {
                        this.st4te._view_element.addEventListener(event, handler, { passive: true });
                    });
                    this._computeSize();
                });
            }
        }
    }

    _setImageRef = (element) => {
        if (element) {
            this.setSt4te({ _image_element_ref: element });
            this._cachedImageRectDirty = true; /* OPT #8 */
        }
    }

    /* OPT #8: Cache getBoundingClientRect, invalidate on resize/zoom */
    _getImageRect = () => {
        if (this._cachedImageRectDirty || !this._cachedImageRect) {
            if (this.st4te._image_element_ref) {
                this._cachedImageRect = this.st4te._image_element_ref.getBoundingClientRect();
                this._cachedImageRectDirty = false;
            }
        }
        return this._cachedImageRect;
    }

    /* OPT #15: Wheel events throttled through rAF */
    _handle_wheel = (e) => {
        this._pendingWheelEvent = e;
        if (!this._rafWheelId) {
            this._rafWheelId = requestAnimationFrame(this._applyWheel);
        }
    }

    _applyWheel = () => {
        this._rafWheelId = null;
        const e = this._pendingWheelEvent;
        if (!e) return;
        this._pendingWheelEvent = null;

        const _view_element_measurement = this.st4te._view_element_measurement;
        const _size = this.st4te._size;
        let current = this._currentZoom;

        const pageX = e.pageX;
        const pageY = e.pageY;
        const movementX = e.movementX;
        const movementY = e.movementY;
        const deltaY = e.deltaY;
        let delta = Math.max(Math.min(0.125, Math.abs(deltaY * -0.01)), 0.25);
        delta = deltaY * -0.01 > 0 ? delta : -delta;

        const scale_change_ratio_on_one = Math.pow(current < 1 ? 1 / current : current, 1.6);
        const new_scale = current + delta * current * (0.9 / scale_change_ratio_on_one);

        if (!(new_scale > 5) && !(new_scale < 0.2)) {
            /* PERF #16: Use measurement values directly — avoid allocating
             * canvas_container/canvas_wrapper objects on every wheel tick */
            const ccLeft = _view_element_measurement.left;
            const ccTop = _view_element_measurement.top;
            const ccW = _view_element_measurement.width;
            const ccH = _view_element_measurement.height;
            const cwW = _size.width * current;
            const cwH = _size.height * current;

            const move_x = this._posLeft;
            const move_y = this._posTop;
            const ratio = 1 - current / new_scale;
            const ratio2 = new_scale / current;
            let pos_x_in_canvas_container, pos_y_in_canvas_container;

            if (Boolean(pageX) && Boolean(pageY)) {
                pos_x_in_canvas_container = pageX - ccLeft | 0;
                pos_y_in_canvas_container = pageY - ccTop | 0;
            } else {
                pos_x_in_canvas_container = ccW / 2 | 0;
                pos_y_in_canvas_container = ccH / 2 | 0;
            }

            let new_scale_move_x = (move_x - (pos_x_in_canvas_container * ratio)) * ratio2 + movementX | 0;
            let new_scale_move_y = (move_y - (pos_y_in_canvas_container * ratio)) * ratio2 + movementY | 0;

            const for_middle_x = (ccW - cwW) / 2 | 0;
            const for_middle_y = (ccH - cwH) / 2 | 0;

            const scale_move_x_max = cwW + for_middle_x;
            const scale_move_y_max = cwH + for_middle_y;

            new_scale_move_y -= for_middle_y;
            new_scale_move_x -= for_middle_x;

            const new_scale_move_x_rigged = Math.min(Math.abs(new_scale_move_x), scale_move_x_max) * (new_scale_move_x < 0 ? -1 : 1) + for_middle_x;
            const new_scale_move_y_rigged = Math.min(Math.abs(new_scale_move_y), scale_move_y_max) * (new_scale_move_y < 0 ? -1 : 1) + for_middle_y;

            /* OPT #1: Update instance vars + direct DOM, then sync st4te for render consistency */
            this._currentZoom = new_scale;
            this._posLeft = new_scale_move_x_rigged;
            this._posTop = new_scale_move_y_rigged;
            this._cachedImageRectDirty = true; /* OPT #8: zoom changed */
            this._applyImageTransform();

            /* Sync to st4te (deferred, no forceUpdate during wheel) */
            this.setSt4te({ zoom: new_scale, position: { left: new_scale_move_x_rigged, top: new_scale_move_y_rigged } });
        }
    }

    /* OPT #1, #2, #20: Unified pointer-down for both mouse and touch.
     * Uses cached rect (#8). Stores drag state in instance vars (#5). */
    _handle_view_pointer_down = (e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;

        /* Handle pinch start: track multiple pointers */
        if (this._activePointers) {
            this._activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this._activePointers.size === 2) {
                const pts = [...this._activePointers.values()];
                this._pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
                this._startZoom = this._currentZoom;
                this._twoPointer = true;
                this._dragging = false;
                return;
            }
        } else {
            this._activePointers = new Map();
            this._activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (this._twoPointer) return;

        const rect = this._getImageRect(); /* OPT #8 */
        if (!rect) return;

        if (
            e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom
        ) {
            this._dragging = true;
            this._dragStartX = e.clientX;
            this._dragStartY = e.clientY;
            this._dragOriginLeft = this._posLeft;
            this._dragOriginTop = this._posTop;

            /* OPT #7: Promote to GPU layer during drag */
            if (this.st4te._image_element_ref) {
                this.st4te._image_element_ref.style.willChange = "transform";
            }
        }
    };

    /* OPT #2: rAF-throttled pointer move — one visual update per frame */
    _handle_view_pointer_move = (e) => {
        /* Handle pinch move */
        if (this._activePointers && this._activePointers.has(e.pointerId)) {
            this._activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (this._activePointers.size === 2 && this._pinchStartDist) {
                const pts = [...this._activePointers.values()];
                const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
                let scale = dist / this._pinchStartDist;
                let zoom = Math.max(0.2, Math.min(this._startZoom * scale, 5));
                this._currentZoom = zoom;
                this._cachedImageRectDirty = true;
                this._applyImageTransform();
                this.setSt4te({ zoom });
                return;
            }
        }

        if (!this._dragging || this._twoPointer) return;

        this._pendingDx = e.clientX - this._dragStartX;
        this._pendingDy = e.clientY - this._dragStartY;

        if (!this._rafDragId) {
            this._rafDragId = requestAnimationFrame(this._applyDrag);
        }
    };

    /* OPT #1, #2: Apply accumulated drag delta in a single rAF callback */
    _applyDrag = () => {
        this._rafDragId = null;
        if (!this._dragging) return;

        this._posLeft = this._dragOriginLeft + this._pendingDx;
        this._posTop = this._dragOriginTop + this._pendingDy;
        this._applyImageTransform();
    }

    _handle_view_pointer_up = (e) => {
        /* Track pointer removal for pinch */
        if (this._activePointers) {
            this._activePointers.delete(e.pointerId);
            if (this._activePointers.size < 2) {
                this._pinchStartDist = null;
            }
            if (this._activePointers.size === 0) {
                this._activePointers = null;
                /* OPT #13: Reset two-pointer flag with proper timeout instead of setInterval */
                if (this._twoPointer) {
                    this._twoPointerTimeout = setTimeout(() => {
                        this._twoPointer = false;
                        this._twoPointerTimeout = null;
                    }, 120);
                }
            }
        }

        if (this._dragging) {
            this._dragging = false;
            this._cachedImageRectDirty = true; /* OPT #8 */

            /* OPT #7: Remove will-change after drag ends */
            if (this.st4te._image_element_ref) {
                this.st4te._image_element_ref.style.willChange = "auto";
            }

            /* Sync final position to st4te (for render consistency) */
            this.setSt4te({
                position: { left: this._posLeft, top: this._posTop }
            });
        }
    };

    _computeSize = () => {
        const mobile = (window.innerWidth || document.documentElement.clientWidth || (document.body || document.getElementsByTagName('body')[0]).clientWidth) <= 960;
        const mobileChanged = this.st4te._view_right_mobile_enabled !== mobile;
        this._cachedImageRectDirty = true; /* OPT #8 */

        const el = this.st4te._view_element;
        if (!el || typeof el.getBoundingClientRect !== "function" || !this.st4te.metadata?.width) {
            if (mobileChanged) {
                this.setSt4te({ _view_right_mobile_enabled: mobile }, () => { this.forceUpdate() });
            }
            return;
        }

        const measurements = el.getBoundingClientRect() || {};
        const metadata = this.st4te.metadata;
        if (!measurements.width || !metadata) {
            if (mobileChanged) {
                this.setSt4te({ _view_right_mobile_enabled: mobile }, () => { this.forceUpdate() });
            }
            return;
        }

        const zoom_max = Math.min((measurements.width - 16) / metadata.width, (measurements.height - 16) / metadata.height);
        const size = {
            width: metadata.width * zoom_max | 0,
            height: metadata.height * zoom_max | 0
        };

        /* PERF #9: Single batched setSt4te instead of 3 nested callbacks */
        const batch = { _view_element_measurement: measurements, _size: size };
        if (mobileChanged) batch._view_right_mobile_enabled = mobile;

        this.setSt4te(batch, () => {
            this._set_size();
            if (mobileChanged) this.forceUpdate();
        });
    }

    /* OPT #11: Debounced resize via rAF */
    _debouncedComputeSize = () => {
        if (!this._resizeRaf) {
            this._resizeRaf = requestAnimationFrame(() => {
                this._resizeRaf = null;
                this._computeSize();
            });
        }
    }

    setCanvasRef = (can) => {
        if (typeof can === "undefined" || can === null) { return; }
        if (typeof can.width === "undefined") { return; }
        if (typeof can.getContext !== "function") { return; }

        var _canvas = can;
        /* PERF #3: This canvas is WRITE-only (drawImage to it, never getImageData).
         * willReadFrequently:true was forcing CPU-side rendering, killing GPU accel.
         * alpha MUST remain true — the canvas composites over blur overlays and
         * clearRect must produce transparent (not opaque black) between artworks.
         * desynchronized:true reduces input latency on supported browsers. */
        _canvas.context = can.getContext("2d", {
            willReadFrequently: false,
            desynchronized: true,
            powerPreference: "high-performance"
        });

        this.setSt4te({ _canvas }, () => {
            this._set_size();
        })
    };

    _setMenuCardRef = (ref) => {
        if (ref) {
            this.setSt4te({ _card_ref: ref }, () => {
                /* Cache the parent wrapper div — this is the element we'll
                 * actually transform during drag (not the Card itself).
                 * The wrapper has overflow:hidden + base translateY on mobile. */
                this._cardWrapperEl = ref.parentElement;

                /* FIX: passive:false so we can preventDefault() during drag to
                 * block scroll/SwipeableViews interference. capture:true to
                 * intercept before children process the event. */
                this._getCardEvents().forEach(([event, handler]) => {
                    this.st4te._card_ref.addEventListener(event, handler, { passive: false, capture: true });
                });
            });
        }
    };

    /* Card drag — pointer capture ensures ALL subsequent pointer events route here,
     * even when the pointer moves over child elements (SwipeableViews, scroll areas).
     * Transform is applied to the WRAPPER div (not the Card) to avoid overflow clipping. */
    _handle_card_pointer_down = (e) => {
        if (!this.st4te._view_right_mobile_enabled) return;

        /* Cancel any ongoing momentum scroll from a previous gesture */
        if (this._scrollMomentumRaf) {
            cancelAnimationFrame(this._scrollMomentumRaf);
            this._scrollMomentumRaf = null;
        }

        this._cardYStart = e.pageY;
        this._cardXStart = e.pageX;
        this._cardYOffset = 0;
        this._cardPointerId = e.pointerId;
        this._cardIsHidden = !this.st4te._view_mobile_opened;
        this._lastPointerY = e.pageY;
        this._scrollVelocity = 0;

        /* Capture pointer so we receive all move/up events regardless of
         * which child element the finger is over. */
        try {
            this.st4te._card_ref.setPointerCapture(e.pointerId);
        } catch (_) {}

        if (!this._cardIsHidden) {
            /* Drawer is OPEN (fullscreen) — enter scroll mode.
             * We manually scroll the active CardContent in pointermove.
             * If user reaches scrollTop=0 and pulls down, we promote to drag. */
            const scrollable = this._findScrollableParent(e.target);
            this._cardScrolling = true;
            this._cardDragging = false;
            this._cardActiveScrollable = scrollable;
            /* Keep children's overflow intact so scrollTop is meaningful */
            return;
        }

        /* Drawer is CLOSED (peeking) — immediate drag mode */
        this._cardScrolling = false;
        this._cardDragging = true;
        this._cardActiveScrollable = null;
        this._setupDragStyles();
    };

    /* FIX: Find the closest scrollable CardContent parent of the touch target */
    _findScrollableParent = (el) => {
        while (el && el !== this.st4te._card_ref) {
            if (el.classList && el.classList.contains("MuiCardContent-root")) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    };

    /* Apply GPU promotion + kill transition on the WRAPPER for drag */
    _setupDragStyles = () => {
        const wrapper = this._cardWrapperEl;
        if (wrapper) {
            wrapper.style.willChange = "transform";
            wrapper.style.transition = "none";
            wrapper.style.overflow = "visible";
        }
        this._setCardContentScroll("hidden");
    };

    _handle_card_pointer_move = (e) => {
        /* ── SCROLL MODE (drawer open, manually scrolling content) ── */
        if (this._cardScrolling) {
            const incrementY = e.pageY - this._lastPointerY;
            this._lastPointerY = e.pageY;
            /* Track velocity for momentum on release (exponential moving average) */
            this._scrollVelocity = 0.6 * incrementY + 0.4 * this._scrollVelocity;

            const scrollable = this._cardActiveScrollable;
            const atTop = !scrollable || scrollable.scrollTop <= 0;

            /* At the top of the scroll area and pulling DOWN → promote to drawer drag.
             * This is the "overscroll to dismiss" gesture. */
            if (atTop && incrementY > 0) {
                const totalDeltaY = e.pageY - this._cardYStart;
                if (totalDeltaY > 8) {
                    this._cardScrolling = false;
                    this._cardDragging = true;
                    /* Reset drag origin to current position so offset starts at 0 */
                    this._cardYStart = e.pageY;
                    this._setupDragStyles();
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            /* Normal manual scroll: finger up → content scrolls down, etc.
             * We always preventDefault to stop the browser from doing anything. */
            e.preventDefault();
            e.stopPropagation();

            if (scrollable) {
                scrollable.scrollTop -= incrementY;
            }
            return;
        }

        /* ── DRAG MODE (drawer peeking or promoted from scroll) ── */
        if (!this._cardDragging) return;

        const deltaY = e.pageY - this._cardYStart;
        const deltaX = Math.abs(e.pageX - this._cardXStart);

        if (Math.abs(deltaY) > 4) {
            e.preventDefault();
            e.stopPropagation();
        }

        this._pendingCardOffset = this._cardIsHidden
            ? Math.min(0, deltaY + deltaX)
            : Math.max(0, deltaY - deltaX);

        /* OPT #2: rAF-throttled card transform — one DOM write per frame */
        if (!this._rafCardId) {
            this._rafCardId = requestAnimationFrame(this._applyCardDrag);
        }
    };

    /* Direct DOM mutation: transforms the WRAPPER div (not Card).
     * When hidden, base is translateY(calc(100% - 96px)), drag adds negative offset.
     * When opened, base is translateY(0px), drag adds positive offset. */
    _applyCardDrag = () => {
        this._rafCardId = null;
        if (!this._cardDragging) return;
        this._cardYOffset = this._pendingCardOffset;
        const wrapper = this._cardWrapperEl;
        if (!wrapper) return;

        if (this._cardIsHidden) {
            /* Drawer peeking: base = calc(100% - 96px), offset is negative (dragging up) */
            wrapper.style.transform = `translateY(calc(100% - 96px + ${this._cardYOffset}px))`;
        } else {
            /* Drawer open: base = 0px, offset is positive (dragging down) */
            wrapper.style.transform = `translateY(${this._cardYOffset}px)`;
        }
    }

    /* Toggle scroll and touch handling on the card's scrollable children during drag.
     * Also sets pointer-events:none on SwipeableViews to prevent its internal
     * non-passive touchmove handlers from firing (fixes the 106ms violation). */
    _setCardContentScroll = (overflow) => {
        const cardEl = this.st4te._card_ref;
        if (!cardEl) return;
        const isDragging = overflow === "hidden";
        const scrollables = cardEl.querySelectorAll(
            '.MuiCardContent-root, .react-swipeable-view-container, .react-swipeable-view-container > div'
        );
        for (let i = 0; i < scrollables.length; i++) {
            scrollables[i].style.overflow = overflow;
            scrollables[i].style.touchAction = isDragging ? "none" : "";
            /* FIX: Block SwipeableViews' own touch event listeners from receiving events.
             * pointer-events:none means no touch/pointer events reach these children,
             * so their non-passive touchmove handlers never fire. */
            scrollables[i].style.pointerEvents = isDragging ? "none" : "";
        }
    }

    /* OPT #3: No forceUpdate during gesture. CSS transition handles the snap. */
    /* On release: decide snap open/close or spring back. Clears inline styles
     * from the WRAPPER and lets the CSS class transition handle the snap. */
    _handle_card_pointer_up = (e) => {
        /* ── SCROLL MODE release — apply momentum then clean up ── */
        if (this._cardScrolling) {
            this._cardScrolling = false;
            try {
                this.st4te._card_ref.releasePointerCapture(this._cardPointerId);
            } catch (_) {}
            /* Kick off momentum scroll with the tracked velocity */
            this._applyScrollMomentum();
            return;
        }

        if (!this._cardDragging) return;

        this._cardDragging = false;

        /* Release pointer capture */
        try {
            this.st4te._card_ref.releasePointerCapture(this._cardPointerId);
        } catch (_) {}

        /* Re-enable scroll + pointer-events on card content */
        this._setCardContentScroll("");

        const offset = this._cardYOffset;
        const hidden = this._cardIsHidden;
        const hysteresisClosed = this._drawerSettings.hysteresisClosed;
        const hysteresisOpened = this._drawerSettings.hysteresisOpened;

        const shouldOpen = hidden && Math.abs(offset) > hysteresisClosed;
        const shouldClose = !hidden && Math.abs(offset) > hysteresisOpened;

        const wrapper = this._cardWrapperEl;

        if (shouldOpen || shouldClose) {
            /* Snap: clear ALL inline styles from wrapper so the CSS class
             * transition (viewRight ↔ viewRightHidden) takes over cleanly. */
            this._cardYOffset = 0;
            if (wrapper) {
                wrapper.style.transition = "";
                wrapper.style.transform = "";
                wrapper.style.willChange = "";
                wrapper.style.overflow = "";
            }

            this.setSt4te({ _view_mobile_opened: shouldOpen }, () => {
                this.forceUpdate();
                /* Clean up will-change after transition settles */
                setTimeout(() => {
                    if (wrapper) wrapper.style.willChange = "";
                }, 300);
            });
        } else {
            /* Didn't cross threshold — spring back to origin */
            this._springBackToOrigin();
        }
    };

    /* rAF-driven spring with exponential decay. Animates the WRAPPER back to
     * its CSS base position, then clears all inline styles. */
    _springBackToOrigin = () => {
        const DAMPING = 0.82;
        const THRESHOLD = 0.5;
        const wrapper = this._cardWrapperEl;
        const isHidden = this._cardIsHidden;

        const animate = () => {
            if (this._cardDragging) {
                /* User re-grabbed, abort spring */
                return;
            }

            this._cardYOffset *= DAMPING;

            if (Math.abs(this._cardYOffset) < THRESHOLD) {
                /* Settled: clear ALL inline styles so CSS class rules apply cleanly */
                this._cardYOffset = 0;
                if (wrapper) {
                    wrapper.style.transform = "";
                    wrapper.style.willChange = "";
                    wrapper.style.transition = "";
                    wrapper.style.overflow = "";
                }
                return;
            }

            /* Animate toward base position */
            if (wrapper) {
                if (isHidden) {
                    wrapper.style.transform = `translateY(calc(100% - 96px + ${this._cardYOffset}px))`;
                } else {
                    wrapper.style.transform = `translateY(${this._cardYOffset}px)`;
                }
            }

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    };

    /* FIX: Momentum scroll — decays the finger velocity after release so
     * manual scrolling feels natural (like native scroll inertia). */
    _applyScrollMomentum = () => {
        const FRICTION = 0.95;
        const THRESHOLD = 0.5;
        const scrollable = this._cardActiveScrollable;
        if (!scrollable) return;

        let velocity = this._scrollVelocity;

        const tick = () => {
            /* Abort if user starts a new gesture */
            if (this._cardScrolling || this._cardDragging) {
                this._scrollMomentumRaf = null;
                return;
            }

            velocity *= FRICTION;

            if (Math.abs(velocity) < THRESHOLD) {
                this._scrollMomentumRaf = null;
                return;
            }

            scrollable.scrollTop -= velocity;

            /* Clamp — stop if we've hit a boundary */
            if (scrollable.scrollTop <= 0 || scrollable.scrollTop >= scrollable.scrollHeight - scrollable.clientHeight) {
                this._scrollMomentumRaf = null;
                return;
            }

            this._scrollMomentumRaf = requestAnimationFrame(tick);
        };

        this._scrollMomentumRaf = requestAnimationFrame(tick);
    };

    _set_imgd = (imgd, b, id, renderId) => {
        if (id !== this.st4te.data.id || renderId !== this._currentRenderId) {
            return;
        }

        const _size = this.st4te._size;
        const can = this.st4te._canvas;

        if (!can || !_size) return;

        /* PERF #15: Setting canvas.width/height clears the bitmap AND resets
         * all context state (fill, stroke, transform, etc). Only resize when
         * the target dimensions actually changed. */
        const targetW = _size.width * 3;
        const targetH = _size.height * 3;
        const needsResize = can.width !== targetW || can.height !== targetH;

        const ar = `${imgd.width} / ${imgd.height}`;
        if (can._cachedAR !== ar) {
            can.style.aspectRatio = ar;
            can._cachedAR = ar;
        }

        if (needsResize) {
            can.width = targetW;
            can.height = targetH;
        } else {
            /* Same size: just clear the rect instead of resetting */
            can.context.clearRect(0, 0, targetW, targetH);
        }

        can.context.drawImage(b, 0, 0, targetW, targetH);

        requestAnimationFrame(() => {
            if (renderId !== this._currentRenderId) return;

            const viewRect = this.st4te._view_element_measurement;
            const finalLeft = viewRect.width / 2 | 0;
            const finalTop = viewRect.height / 2 | 0;
            const finalZoom = this.st4te.zoom || 1.33;

            // ── Subsequent renders for the SAME artwork: preserve position ──
            // If we already set position for this artwork, don't reset it
            if (this._positionSetForId === id && !this._heroAnimating) {
                // Canvas was re-drawn (e.g. renderer finished) but artwork is the same
                // Keep current position/zoom, just make sure it's visible
                if (this.st4te._hidden) {
                    this.setSt4te({ _hidden: false }, () => {
                        this._applyImageTransform();
                        this.forceUpdate();
                    });
                } else {
                    this._applyImageTransform();
                }
                return;
            }

            // ── Hero animation: start at the PaperCard's position, fly to center ──
            if (this._heroAnimating && this._originRect) {
                const origin = this._originRect;
                const canvasVisualW = _size.width * 2;

                // Compute starting zoom so the canvas visual matches the origin width
                const startZoom = (origin.width / canvasVisualW) * 3;
                const startLeft = (origin.left + origin.width / 2) | 0;
                const startTop = (origin.top + origin.height / 2) | 0;

                // 1) Position at origin instantly (no transition)
                this._posLeft = startLeft;
                this._posTop = startTop;
                this._currentZoom = startZoom;
                this._cachedImageRectDirty = true;

                const imgRef = this.st4te._image_element_ref;
                if (imgRef) {
                    imgRef.classList.remove(this.st4te.classes.heroTransition);
                    // Force layout flush so the browser commits the start position
                    imgRef.style.transform =
                        `translate3d(calc(${startLeft}px - 50%), calc(${startTop}px - 50%), 0) scale(${(startZoom / 3).toFixed(4)})`;
                    // Force a style recalc so the start position is committed before transition
                    void imgRef.offsetHeight;
                }

                // Show immediately (skip the scale(.5) → scale(1) appear animation)
                this.setSt4te({ _hidden: false, position: { left: startLeft, top: startTop } }, () => {
                    this.forceUpdate(() => {
                        // 2) Double rAF ensures the browser has painted the start position
                        //    before we add the transition class, preventing the jerk
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                if (renderId !== this._currentRenderId) return;

                                this._posLeft = finalLeft;
                                this._posTop = finalTop;
                                this._currentZoom = finalZoom;
                                this._positionSetForId = id; // Mark position as set

                                if (imgRef) {
                                    imgRef.classList.add(this.st4te.classes.heroTransition);
                                    imgRef.style.transform =
                                        `translate3d(calc(${finalLeft}px - 50%), calc(${finalTop}px - 50%), 0) scale(${(finalZoom / 3).toFixed(4)})`;
                                }

                                this.setSt4te({ position: { left: finalLeft, top: finalTop }, zoom: finalZoom });

                                // 3) Clean up after transition completes (match CSS 420ms + margin)
                                if (this._heroTransitionTimer) clearTimeout(this._heroTransitionTimer);
                                this._heroTransitionTimer = setTimeout(() => {
                                    this._heroAnimating = false;
                                    this._originRect = null;
                                    this._drawerHasAppeared = true;
                                    if (imgRef) {
                                        imgRef.classList.remove(this.st4te.classes.heroTransition);
                                    }
                                    // Sync st4te so render picks up final values cleanly
                                    this.setSt4te({ position: { left: finalLeft, top: finalTop }, zoom: finalZoom }, () => {
                                        this.forceUpdate();
                                    });
                                }, 460);
                            });
                        });
                    });
                });
                return;
            }

            // ── Default: center instantly (no hero) ──
            this._posLeft = finalLeft;
            this._posTop = finalTop;
            this._positionSetForId = id; // Mark position as set
            this._cachedImageRectDirty = true;

            this.setSt4te({ _hidden: false, position: { left: finalLeft, top: finalTop } }, () => {
                this._applyImageTransform();
                this.forceUpdate();

                // If this render was triggered by arrow nav, schedule bounce cleanup
                if (this._navBouncing) {
                    if (this._navBounceTimer) clearTimeout(this._navBounceTimer);
                    this._navBounceTimer = setTimeout(() => {
                        this._finishBounceIn();
                    }, 650);
                } else {
                    /* Mark drawer as appeared so future renders use viewRightNoAnim
                     * instead of re-triggering the slide-in animation. Allow time
                     * for the current slide-in to finish (500ms anim + 80ms delay). */
                    setTimeout(() => {
                        this._drawerHasAppeared = true;
                    }, 600);
                }
            });
        });
    }

    _download_with_watermark = () => {
        this.setSt4te({ _download_loading: true }, () => { this.forceUpdate() });
        JSLoader(() => import("../utils/watermark")).then((d) => {

            const renderIt = (imgd) => {
                "use strict";
                if (this.st4te.renderer === "hexagon") {

                    const img_original = this.st4te.metadata?.imgd;
                    const { width, height } = img_original;
                    const ratio = width / height;
                    const width2 = imgd.width;
                    const height2 = Math.ceil(imgd.width / ratio);
                    const cnvs = createCanvas(imgd.width, imgd.height);
                    const cnvs2 = createCanvas(width2, height2);
                    cnvs.ctx.putImageData(imgd, 0, 0);
                    cnvs2.ctx.drawImage(cnvs, 0, 0, cnvs.width, cnvs.height, 0, 0, cnvs2.width, cnvs2.height);
                    imgd = cnvs2.ctx.getImageData(0, 0, cnvs2.width, cnvs2.height, { colorSpace: "srgb" })

                }

                d.default(imgd, "@" + this.st4te.data.author?.username, new Date(this.st4te.data?.date || Date.now()).getFullYear(), this.st4te.format.toUpperCase()).then((b64) => {
                    let a = document.createElement("a");
                    a.href = b64;
                    a.download = "Artwork_From_@" + this.st4te.data.author?.username + "_Printed_Using_" + this.st4te.renderer.toUpperCase() + "." + ("" + this.st4te.format).toLowerCase();
                    a.style.display = "hidden";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    this.setSt4te({ _download_loading: false }, () => { this.forceUpdate() });
                })
            };

            let scale = 1;
            let imgd = this.st4te.metadata?.imgd;
            const id = "" + this.st4te.data.id;

            if (imgd) {
                if (this.st4te.renderer === "hexagon") {
                    scale = Math.max(Math.min(32, Math.ceil(this.st4te._size?.width / this.st4te.metadata?.width) * 2), 3);
                    hexF(imgd, scale, (d) => { renderIt(d) }, true, id, this.st4te.mode);
                } else if (this.st4te.renderer === "xbrz") {
                    scale = Math.max(Math.min(32, Math.ceil(this.st4te._size?.width / this.st4te.metadata?.width) * 4), 2);
                    xbrzF(imgd, scale, (d) => {
                        if (imgd.width * scale - 128 < d.width) {
                            renderIt(d);
                        }
                    }, true, id, this.st4te.mode);
                } else if (this.st4te.renderer === "crt") {
                    scale = Math.max(Math.min(32, Math.ceil(this.st4te._size?.width / this.st4te.metadata?.width) * 4), 2);
                    crtF(imgd, scale, (d) => { renderIt(d) }, true, id, this.st4te.mode);
                } else {
                    scale = Math.max(Math.min(32, Math.ceil(this.st4te._size?.width / this.st4te.metadata?.width) * 4), 2);
                    sqrF(imgd, scale, (d) => { renderIt(d) }, true, id, this.st4te.mode)
                }
            }
        });
    }

    _render_hex = () => {
        const id = "" + this.st4te.data.id;
        const renderId = this._currentRenderId;
        const scale = Math.max(Math.min(32, Math.ceil(this.st4te._size?.width / this.st4te.metadata?.width * 1)), 3);

        hexF(this.st4te.metadata?.imgd, scale, (d, b) => {
            this._set_imgd(d, b, id, renderId);
        }, true, id, this.st4te.mode);
    }

    _render_smooth = () => {
        const id = "" + this.st4te.data.id;
        const renderId = this._currentRenderId;
        const scale = Math.max(Math.min(32, Math.ceil(this.st4te._size?.width / this.st4te.metadata?.width) * 2), 6);

        xbrzF(this.st4te.metadata?.imgd, scale, (d, b) => {
            this._set_imgd(d, b, id, renderId);
        }, true, id, this.st4te.mode);
    }

    _render_crt = () => {
        const id = "" + this.st4te.data.id;
        const renderId = this._currentRenderId;
        const scale = Math.max(Math.min(32, Math.ceil(this.st4te._size?.width / this.st4te.metadata?.width) * 2), 6);

        crtF(this.st4te.metadata?.imgd, scale, (d, b) => {
            this._set_imgd(d, b, id, renderId);
        }, true, id, this.st4te.mode);
    }

    _render_square = () => {
        const id = "" + this.st4te.data.id;
        const renderId = this._currentRenderId;
        const scale = Math.max(Math.min(32, Math.ceil(this.st4te._size?.width / this.st4te.metadata?.width) * 2), 6);

        sqrF(this.st4te.metadata?.imgd, scale, (d, b) => {
            this._set_imgd(d, b, id, renderId);
        }, true, id, this.st4te.mode);
    }

    _clearCanvas = () => {
        const can = this.st4te._canvas;
        if (can) {
            /* Setting width/height to 0 makes the canvas bitmap empty — it renders
             * as fully transparent regardless of CSS dimensions, so there is no
             * flash of stale content at the wrong size between artwork transitions.
             * _set_imgd will resize it back when the new artwork is ready. */
            can.width = 0;
            can.height = 0;
            can._cachedAR = null;
        }
    }

    _set_size = () => {
        if (this.st4te.metadata?.imgd) {
            if (this.st4te.renderer === "hexagon") {
                this._render_hex();
            } else if (this.st4te.renderer === "xbrz") {
                this._render_smooth();
            } else if (this.st4te.renderer === "crt") {
                this._render_crt();
            } else {
                this._render_square();
            }
        }
    }

    /* ── Arrow navigation with dismiss → bounce transition ────────── */

    _handleArrowNav = (direction) => {
        if (this._navTransitioning) return;

        this._navTransitioning = true;
        this._navDismissing = true;
        this._navDirection = direction;
        this.forceUpdate();

        // After dismiss animation completes, trigger the actual navigation
        this._navDismissTimer = setTimeout(() => {
            this._navDismissing = false;
            this._navBouncing = true; // Flag: next artwork should bounce in

            if (direction === "next" && this.props.onNext) {
                this.props.onNext();
            } else if (direction === "prev" && this.props.onPrevious) {
                this.props.onPrevious();
            }
        }, 220);
    }

    _handleArrowPrev = () => { this._handleArrowNav("prev"); }
    _handleArrowNext = () => { this._handleArrowNav("next"); }

    _finishBounceIn = () => {
        this._navBouncing = false;
        this._navTransitioning = false;
        this._navDirection = null;
        this._drawerHasAppeared = true;
        this.forceUpdate();
    }

    _set_menu_open = () => {
        this.setSt4te({ _view_mobile_opened: true }, () => {
            this.forceUpdate(() => {
                this.swipeableViewScrollTop();
            });
        });
    }

    _set_menu_close = () => {
        if (this.st4te._view_right_mobile_enabled) {
            this.setSt4te({ _view_mobile_opened: false }, () => {
                this.forceUpdate(() => {
                    this.swipeableViewScrollTop();
                });
            });
        } else {
            this.props.onClose();
            this.swipeableViewScrollTop();
        }
    }

    _onRequestClose = () => {
        const { _view_mobile_opened, _view_right_mobile_enabled } = this.st4te;
        if (_view_mobile_opened && _view_right_mobile_enabled) {
            this._set_menu_close();
        } else {
            this.props.onClose();
        }
    }

    _open_author = (username) => {
        this.st4te._history.push("/@" + username);
    }

    _set_tag_naviguation = (tag) => {
        this.st4te._history.push("/trending/" + tag);
        this.props.onClose();
    }

    _handle_open_license_dialog = () => {
        const { data } = this.st4te;
        const author = data.author || {};

        // Parse the license from json_metadata
        let meta = {};
        try {
            meta = typeof data.json_metadata === 'string'
                ? JSON.parse(data.json_metadata)
                : (data.json_metadata || {});
        } catch (e) {}

        const license = meta.license || {};
        const storedHolderRights = license.rightsConfiguration?.holderRights || {};
        const storedVisitorRights = license.rightsConfiguration?.visitorRights || {};

        const customization = {
            isCustomized: license.isCustomized ?? true,
            customizedDate: new Date().toISOString(),
            authorInfo: {
                username: author.username || 'unknown',
                name: author.name || 'Unknown Artist',
                url: `https://pixagram.com/@${author.username || 'unknown'}`
            },
            artworkInfo: {
                title: data.title || `Artwork #${data.id}`,
                creationDate: data.created || data.date || new Date().toISOString(),
                nftContract: data.nftContract || data.contractAddress
            },
            rightsConfiguration: {
                holderRights: {
                    "personal-display": storedHolderRights["personal-display"] ?? true,
                    "commercial-use": storedHolderRights["commercial-use"] ?? false,
                    "social-media": storedHolderRights["social-media"] ?? false,
                    "physical-goods": storedHolderRights["physical-goods"] ?? false,
                    "third-party-licensing": storedHolderRights["third-party-licensing"] ?? false,
                    "modify": storedHolderRights["modify"] ?? false,
                    "derivatives": storedHolderRights["derivatives"] ?? false,
                    "mint-new-nfts": storedHolderRights["mint-new-nfts"] ?? false,
                    "metaverse": storedHolderRights["metaverse"] ?? false,
                    "games-apps": storedHolderRights["games-apps"] ?? false,
                    "music-video-film": storedHolderRights["music-video-film"] ?? false,
                    "exhibitions": storedHolderRights["exhibitions"] ?? false,
                    "educational": storedHolderRights["educational"] ?? false,
                    "ai-training": storedHolderRights["ai-training"] ?? false
                },
                visitorRights: {
                    "share-with-attribution": storedVisitorRights["share-with-attribution"] ?? true,
                    "share-without-attribution": storedVisitorRights["share-without-attribution"] ?? false,
                    "modify-and-share": storedVisitorRights["modify-and-share"] ?? false,
                    "ai-training": storedVisitorRights["ai-training"] ?? false
                }
            },
            royaltyPercentage: license.royaltyPercentage ?? 10,
            governingLaw: {
                jurisdiction: license.governingLaw?.jurisdiction || "",
                court: license.governingLaw?.court || "",
                arbitrationLocation: license.governingLaw?.arbitrationLocation || "",
                arbitrationRules: license.governingLaw?.arbitrationRules || ""
            }
        };

        this.setSt4te({
            _license_dialog_opened: true,
            _license_customization: customization
        }, () => {
            this.forceUpdate()
        });
    };

    _handle_close_license_dialog = () => {
        this.setSt4te({ _license_dialog_opened: false }, () => { this.forceUpdate() });
    };

    _download_artwork = () => {
        let a = document.createElement("a");
        a.href = this.st4te.data.image;
        a.download = this.st4te.data.title + "." + this.st4te.type;
        a.style.display = "hidden";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    _handle_sorting_change = (event) => {
        this.setSt4te({ _sorting: event.target.value.toString() }, () => {
            this._get_views(true);
            this.forceUpdate();
        });
    };

    _show_replies = (comment) => {
        let _current_comments = this.st4te._current_comments;
        _current_comments = _current_comments.concat(comment);
        this.setSt4te({ _current_comments }, () => {
            // Fetch children of the clicked comment
            const author = comment.username || (comment.author || {}).username;
            const permlink = comment.permlink;
            if (author && permlink) {
                this._fetch_replies_for(author, permlink);
            } else {
                this._get_views(true);
                this.forceUpdate();
            }
        });
    };

    _slice_replies = (n) => {
        let _current_comments = this.st4te._current_comments;
        _current_comments = _current_comments.slice(0, n);
        this.setSt4te({ _current_comments }, () => {
            if (n === 0) {
                // Back to root: fetch post's replies
                this._fetch_comments();
            } else {
                // Fetch children of the last comment in the chain
                const parent = _current_comments[_current_comments.length - 1];
                const author = parent.username || (parent.author || {}).username;
                const permlink = parent.permlink;
                if (author && permlink) {
                    this._fetch_replies_for(author, permlink);
                }
            }
        });
    }

    _toggle_show_parent = () => {
        let _show_parent = this.st4te._show_parent;
        _show_parent = !_show_parent;
        this.setSt4te({ _show_parent }, () => {
            this._get_views(true);
            this.forceUpdate();
        });
    }

    _fetch_comments = () => {
        const { api, data } = this.st4te;
        if (!api || !data) return;

        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        this._fetch_replies_for(authorUsername, permlink);
    }

    _fetch_replies_for = (author, permlink, silent) => {
        const { api } = this.st4te;
        if (!api) return;

        if (!silent) {
            this.setSt4te({ _comments_loading: true }, () => { this.forceUpdate(); });
        }

        api.content.getContentReplies(author, permlink)
            .then((replies) => {
                if (!replies || !Array.isArray(replies) || replies.length === 0) {
                    // Keep only optimistic comments whose parent matches this context
                    const survivingOptimistic = (this.st4te._comments || [])
                        .filter(c => c._optimistic && c.parent_author === author && c.parent_permlink === permlink);
                    this.setSt4te({ _comments: survivingOptimistic, _comments_loading: false }, () => {
                        this._get_views(true);
                        this.forceUpdate();
                    });
                    return;
                }

                // Collect unique author usernames to batch-fetch profiles
                const uniqueAuthors = [...new Set(replies.map(r => r.author).filter(Boolean))];

                // Fetch account data for profile images
                const accountsPromise = (uniqueAuthors.length > 0 && api.accounts)
                    ? api.accounts.getAccounts(uniqueAuthors).catch(() => [])
                    : Promise.resolve([]);

                accountsPromise.then((accounts) => {
                    // Build a lookup: username → { name, image, username }
                    const profileMap = {};
                    const localAuthors = this.st4te._authors || {};

                    if (Array.isArray(accounts)) {
                        for (const acc of accounts) {
                            const uname = acc.name || acc.account || "";
                            if (!uname) continue;
                            let profileImage = "";
                            let displayName = uname;
                            try {
                                const meta = typeof acc.posting_json_metadata === "string"
                                    ? JSON.parse(acc.posting_json_metadata)
                                    : (acc.posting_json_metadata || {});
                                const profile = meta.profile || {};
                                profileImage = profile.profile_image || profile.image || "";
                                displayName = profile.name || uname;
                            } catch(e) {
                                try {
                                    const meta2 = typeof acc.json_metadata === "string"
                                        ? JSON.parse(acc.json_metadata)
                                        : (acc.json_metadata || {});
                                    const profile2 = meta2.profile || {};
                                    profileImage = profile2.profile_image || profile2.image || "";
                                    displayName = profile2.name || uname;
                                } catch(e2) {}
                            }
                            profileMap[uname] = { username: uname, name: displayName, image: profileImage };
                        }
                    }

                    const comments = replies.map((reply) => {
                        const uname = reply.author || "";
                        const upVotes = (reply.active_votes || []).filter(v => v.weight >= 0).length;
                        const downVotes = (reply.active_votes || []).filter(v => v.weight < 0).length;

                        // Sanitize the comment body to safe HTML
                        let sanitizedBody = reply.body || "";
                        try {
                            const result = rawSanitizeComment(sanitizedBody);
                            sanitizedBody = result.html || sanitizedBody;
                        } catch(e) {
                            console.warn('[PostDialog] Comment sanitization failed:', e.message);
                        }

                        // Resolve author profile: API accounts > local authors > fallback
                        const authorProfile = profileMap[uname]
                            || localAuthors[uname]
                            || { username: uname, name: uname, image: "" };

                        return {
                            username: uname,
                            body: sanitizedBody,
                            date: reply.created || Date.now(),
                            upVotesNumber: upVotes,
                            downVotesNumber: downVotes,
                            permlink: reply.permlink || "",
                            children: reply.children || 0,
                            active_votes: reply.active_votes || [],
                            author: authorProfile
                        };
                    });

                    // Merge: keep optimistic comments that belong to this parent and haven't appeared in chain data yet
                    const chainPermlinks = new Set(comments.map(c => c.permlink));
                    const survivingOptimistic = (this.st4te._comments || [])
                        .filter(c => c._optimistic && !chainPermlinks.has(c.permlink) && c.parent_author === author && c.parent_permlink === permlink);
                    const merged = survivingOptimistic.concat(comments);

                    this.setSt4te({ _comments: merged, _comments_loading: false }, () => {
                        this._get_views(true);
                        this.forceUpdate();
                    });
                });
            })
            .catch((e) => {
                console.warn('[PostDialog] Failed to fetch comments:', e.message);
                this.setSt4te({ _comments_loading: false }, () => { this.forceUpdate(); });
            });
    }

    _get_comment_input_value = () => {
        const tf = document.getElementById("comment-textfield");
        if (!tf) return "";
        // Material-UI TextField wraps an <input> inside; try the element itself first
        if (tf.value !== undefined) return tf.value;
        const input = tf.querySelector && tf.querySelector("input, textarea");
        return input ? input.value : "";
    }

    _clear_comment_input = () => {
        const tf = document.getElementById("comment-textfield");
        if (tf) {
            // Handle native input
            if (tf.value !== undefined) tf.value = "";
            const input = tf.querySelector && tf.querySelector("input, textarea");
            if (input) input.value = "";
            // Dispatch input event so Material-UI updates its internal state
            const ev = new Event("input", { bubbles: true });
            (input || tf).dispatchEvent(ev);
        }
    }

    _submit_comment = () => {
        const { api, account, data, _reply_target } = this.st4te;
        if (!account) { actions.trigger_snackbar("Please register or log in to comment"); return; }
        if (!api) return;

        const body = this._get_comment_input_value().trim();
        if (!body) { actions.trigger_snackbar("Comment cannot be empty"); return; }

        // If replying to a specific comment, use that as parent; otherwise reply to post
        const parentAuthor = _reply_target
            ? (_reply_target.username || (_reply_target.author || {}).username)
            : (data.author || {}).username;
        const parentPermlink = _reply_target
            ? _reply_target.permlink
            : data.permlink;
        if (!parentAuthor || !parentPermlink) return;

        // Generate a unique permlink for the comment
        const commentPermlink = "re-" + parentAuthor + "-" + parentPermlink + "-" + Date.now().toString(36);

        // Capture the body and metadata before clearing
        const commentBody = body;
        const replyTarget = _reply_target;

        this.setSt4te({ _comment_sending: true }, () => { this.forceUpdate(); });

        api.broadcast.comment({
            parentAuthor: parentAuthor,
            parentPermlink: parentPermlink,
            author: account,
            permlink: commentPermlink,
            title: "",
            body: commentBody,
            jsonMetadata: JSON.stringify({ app: "pixagram", format: "text" })
        })
            .then(() => {
                // Build optimistic comment and insert it immediately
                const optimisticComment = this._build_optimistic_comment(account, commentPermlink, commentBody, parentAuthor, parentPermlink);

                // Prepend to current comment list
                let updatedComments = [optimisticComment].concat(this.st4te._comments);
                this.setSt4te({ _comments: updatedComments, _comment_sending: false, _reply_target: null }, () => {
                    this._get_views(true);
                    this.forceUpdate();
                    this._clear_comment_input();
                    actions.trigger_snackbar("Comment posted");

                    // Increment children count on the parent
                    if (replyTarget) {
                        // Replying to a specific comment — increment its children count
                        replyTarget.children = (replyTarget.children || 0) + 1;
                    } else if (data) {
                        // Replying to the post itself
                        data.children = (data.children || 0) + 1;
                    }

                    // Notify parent so profile/feed can update
                    if (this.props.onCommentPost) {
                        this.props.onCommentPost({
                            parentAuthor,
                            parentPermlink,
                            author: account,
                            permlink: commentPermlink,
                            body: commentBody,
                            postAuthor: (data.author || {}).username,
                            postPermlink: data.permlink,
                            optimisticComment
                        });
                    }

                    // Background refresh to get the real chain data
                    this._start_comment_refresh();
                });
            })
            .catch((e) => {
                console.warn('[PostDialog] comment broadcast failed:', e.message);
                actions.trigger_snackbar("Failed to post comment");
                this.setSt4te({ _comment_sending: false }, () => { this.forceUpdate(); });
            });
    }

    _build_optimistic_comment = (account, permlink, body, parentAuthor, parentPermlink) => {
        // Sanitize the body
        let sanitizedBody = body;
        try {
            const result = rawSanitizeComment(body);
            sanitizedBody = result.html || body;
        } catch(e) {}

        // Resolve profile: use _authors cache, or _accounts cache, or fallback
        const localAuthors = this.st4te._authors || {};
        const localAccounts = this.st4te._accounts || {};
        const authorProfile = localAuthors[account]
            || localAccounts[account]
            || { username: account, name: account, image: "" };

        return {
            username: account,
            body: sanitizedBody,
            date: Date.now(),
            upVotesNumber: 0,
            downVotesNumber: 0,
            permlink: permlink,
            children: 0,
            active_votes: [],
            author: authorProfile,
            parent_author: parentAuthor,
            parent_permlink: parentPermlink,
            _optimistic: true
        };
    }

    _cache_own_profile = () => {
        const { api, account, _authors, _accounts } = this.st4te;
        if (!api || !account) return;
        // Already cached
        if ((_authors || {})[account] || (_accounts || {})[account]) return;

        api.accounts.getAccounts([account])
            .then((accs) => {
                if (!accs || !accs.length) return;
                const acc = accs[0];
                const uname = acc.name || acc.account || account;
                let profileImage = "";
                let displayName = uname;
                try {
                    const meta = typeof acc.posting_json_metadata === "string"
                        ? JSON.parse(acc.posting_json_metadata)
                        : (acc.posting_json_metadata || {});
                    const profile = meta.profile || {};
                    profileImage = profile.profile_image || profile.image || "";
                    displayName = profile.name || uname;
                } catch(e) {
                    try {
                        const meta2 = typeof acc.json_metadata === "string"
                            ? JSON.parse(acc.json_metadata)
                            : (acc.json_metadata || {});
                        const profile2 = meta2.profile || {};
                        profileImage = profile2.profile_image || profile2.image || "";
                        displayName = profile2.name || uname;
                    } catch(e2) {}
                }
                const cached = Object.assign({}, this.st4te._accounts || {});
                cached[uname] = { username: uname, name: displayName, image: profileImage };
                this.setSt4te({ _accounts: cached });
            })
            .catch(() => {});
    }

    _start_comment_refresh = () => {
        // Clear any existing timer
        if (this._commentRefreshTimer) {
            clearInterval(this._commentRefreshTimer);
            this._commentRefreshTimer = null;
        }

        let attempts = 0;
        const maxAttempts = 6;

        // Poll every 3 seconds, up to 6 times (18 seconds total)
        this._commentRefreshTimer = setInterval(() => {
            attempts++;
            this._refresh_current_level();
            if (attempts >= maxAttempts) {
                clearInterval(this._commentRefreshTimer);
                this._commentRefreshTimer = null;
            }
        }, 3000);
    }

    _refresh_current_level = () => {
        const { api, data, _current_comments } = this.st4te;
        if (!api || !data) return;

        // If viewing nested replies, refresh that level; otherwise refresh root
        if (_current_comments && _current_comments.length > 0) {
            const parent = _current_comments[_current_comments.length - 1];
            const author = parent.username || (parent.author || {}).username;
            const permlink = parent.permlink;
            if (author && permlink) {
                this._fetch_replies_for(author, permlink, true);
                return;
            }
        }

        // Root level — silent refresh
        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (authorUsername && permlink) {
            this._fetch_replies_for(authorUsername, permlink, true);
        }
    }

    _reply_to_comment = (commentData) => {
        // Navigate into the comment's reply thread (like show_replies)
        let _current_comments = this.st4te._current_comments;
        _current_comments = _current_comments.concat(commentData);

        // Set reply target and update breadcrumb in one go
        this.setSt4te({ _current_comments, _reply_target: commentData, _tab_value: 1 }, () => {
            this._get_views(true);
            this.forceUpdate();

            // Fetch children of the comment to show existing replies
            const author = commentData.username || (commentData.author || {}).username;
            const permlink = commentData.permlink;
            if (author && permlink) {
                this._fetch_replies_for(author, permlink);
            }

            // Focus the TextField after tab transition
            setTimeout(() => {
                const tf = document.getElementById("comment-textfield");
                if (tf) {
                    const input = tf.querySelector && tf.querySelector("input, textarea");
                    (input || tf).focus();
                }
            }, 300);
        });
    }

    /**
     * Resolve the initial vote state from active_votes for the current user.
     * Matches PaperCard: after sanitization votes have { voter, weight, rshares, time }.
     * Presence in active_votes with weight >= 0 = upvote, weight < 0 = downvote.
     */
    _resolve_initial_voted = (data, account) => {
        if (!account || !data || !Array.isArray(data.active_votes)) return 0;
        const myVote = data.active_votes.find(v => v && v.voter === account);
        if (!myVote) return 0;
        if (myVote.weight < 0) return -1;
        return 1; // present in active_votes with weight >= 0 means upvoted
    }

    /**
     * Compute active_votes reflecting current local vote state (matches PaperCard's currentActiveVotes).
     * Base = original active_votes minus current voter, then add voter's new vote entry.
     */
    _get_current_active_votes = () => {
        const { data, _voted, account } = this.st4te;
        const base = (data.active_votes || []).filter(v => v && v.voter !== account);
        if (_voted === 1 && account) {
            base.push({ voter: account, weight: 10000, rshares: '0', time: null });
        } else if (_voted === -1 && account) {
            base.push({ voter: account, weight: -10000, rshares: '0', time: null });
        }
        return base;
    }

    _trigger_positive_votes = () => {
        const currentActiveVotes = this._get_current_active_votes();
        actions.trigger_votes({ sign: '+', votes: currentActiveVotes, voter_profiles: this.st4te.data._voter_profiles || {} });
    }

    _trigger_negative_votes = () => {
        const currentActiveVotes = this._get_current_active_votes();
        actions.trigger_votes({ sign: '-', votes: currentActiveVotes, voter_profiles: this.st4te.data._voter_profiles || {} });
    }

    _upvote_toggle = () => {
        const { account } = this.st4te;
        if (!account) { actions.trigger_snackbar("Please register or log in to vote"); return; }
        if (this.st4te._upvoteLoading || this.st4te._downvoteLoading) return;

        const { data, api } = this.st4te;
        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        this.setSt4te({ _upvoteLoading: true }, () => { this.forceUpdate(); });

        const newVoted = this.st4te._voted !== 1 ? 1 : 0;
        const weight = newVoted === 1 ? 10000 : 0;

        if (api) {
            api.broadcast.vote(account, authorUsername, permlink, weight)
                .then(() => {
                    this.setSt4te({ _voted: newVoted }, () => { this.forceUpdate(); });
                    if (this.props.onVoteChange) this.props.onVoteChange(permlink, account, weight);
                })
                .catch((e) => {
                    console.warn('[PostDialog] vote failed:', e.message);
                })
                .finally(() => {
                    this.setSt4te({ _upvoteLoading: false }, () => { this.forceUpdate(); });
                });
        } else {
            this.setSt4te({ _upvoteLoading: false }, () => { this.forceUpdate(); });
        }
    }

    _downvote_toggle = () => {
        const { account } = this.st4te;
        if (!account) { actions.trigger_snackbar("Please register or log in to vote"); return; }
        if (this.st4te._upvoteLoading || this.st4te._downvoteLoading) return;

        const { data, api } = this.st4te;
        const authorUsername = (data.author || {}).username;
        const permlink = data.permlink;
        if (!authorUsername || !permlink) return;

        this.setSt4te({ _downvoteLoading: true }, () => { this.forceUpdate(); });

        const newVoted = this.st4te._voted !== -1 ? -1 : 0;
        const weight = newVoted === -1 ? -10000 : 0;

        if (api) {
            api.broadcast.vote(account, authorUsername, permlink, weight)
                .then(() => {
                    this.setSt4te({ _voted: newVoted }, () => { this.forceUpdate(); });
                    if (this.props.onVoteChange) this.props.onVoteChange(permlink, account, weight);
                })
                .catch((e) => {
                    console.warn('[PostDialog] vote failed:', e.message);
                })
                .finally(() => {
                    this.setSt4te({ _downvoteLoading: false }, () => { this.forceUpdate(); });
                });
        } else {
            this.setSt4te({ _downvoteLoading: false }, () => { this.forceUpdate(); });
        }
    }

    /* PERF #7: Cache sorted comments — only re-sort when input array or sorting method changes */
    _getSortedComments = () => {
        const { _comments, _sorting } = this.st4te;
        const key = `${_sorting}:${_comments.length}:${_comments === this._sortedCommentsCacheRef ? 1 : 0}`;

        if (this._sortedCommentsCacheKey === key && this._sortedCommentsCacheRef === _comments) {
            return this._sortedCommentsCache;
        }

        this._sortedCommentsCacheRef = _comments;
        this._sortedCommentsCacheKey = key;
        this._sortedCommentsCache = _comments.slice().sort((a, b) => {
            switch (_sorting) {
                case "Votes":
                    return (b.upVotesNumber - b.downVotesNumber) - (a.upVotesNumber - a.downVotesNumber);
                case "Age":
                    const dateA = typeof a.date === "string" ? new Date(a.date).getTime() : (a.date || 0);
                    const dateB = typeof b.date === "string" ? new Date(b.date).getTime() : (b.date || 0);
                    return dateB - dateA;
                case "Hype":
                default:
                    const hypeA = (a.upVotesNumber || 0) + (a.children || 0);
                    const hypeB = (b.upVotesNumber || 0) + (b.children || 0);
                    return hypeB - hypeA;
            }
        });
        return this._sortedCommentsCache;
    }

    _get_views = (v = undefined) => {
        const {
            classes,
            _copied,
            metadata = {},
            _tab_value,
            kb,
            type,
            _comments,
            _sorting,
            _current_comments,
            _show_parent,
            _comments_loading,
            locales,
            data = {}
        } = this.st4te;

        const id = data.id;
        const tags = data.tags || [];
        const _sorted_comments = this._getSortedComments();

        /* PERF #6: Build a cache key from all inputs that affect the view tree.
         * If nothing changed, return the previously built JSX array. */
        const cacheKey = `${id}:${_copied}:${_sorting}:${_show_parent}:${_comments_loading}:${_comments.length}:${_current_comments.length}:${metadata.width}:${kb}:${type}:${tags.length}:${this.st4te.api ? 1 : 0}:${this.st4te.account || ''}`;
        if (!v && this._cachedViewsKey === cacheKey && this._cachedViews) {
            return this._cachedViews;
        }
        this._cachedViewsKey = cacheKey;

        this._cachedViews = [
            <CardContent
                key={"view-0"}
                style={STYLE_CARDCONTENT_0}
            >
                <DetailsView
                    id={id}
                    data={data}
                    metadata={metadata}
                    classes={classes}
                    type={type}
                    kb={kb}
                    tags={tags}
                    onTagClick={this._handleTagClick}
                    onDownloadArtwork={this._handleDownloadArtwork}
                    onOpenLicenseDialog={this._handleOpenLicenseDialog}
                    copied={_copied}
                    onCopy={this._handleCopy}
                />
            </CardContent>,
            <CardContent
                key={"view-1"}
                style={STYLE_CARDCONTENT_1}
            >
                <CommentsView
                    id={id}
                    currentComments={_current_comments}
                    showParent={_show_parent}
                    sorting={_sorting}
                    comments={_sorted_comments}
                    classes={classes}
                    locales={locales}
                    commentsLoading={_comments_loading}
                    api={this.st4te.api}
                    account={this.st4te.account}
                    onToggleShowParent={this._handleToggleShowParent}
                    onSliceReplies={this._handleSliceReplies}
                    onSortingChange={this._handleSortingChange}
                    onShowReplies={this._handleShowReplies}
                    onOpenAuthor={this._handleOpenAuthor}
                    onReply={this._handleReplyToComment}
                />
            </CardContent>,
            <CardContent
                key={"view-2"}
                style={STYLE_CARDCONTENT_2}
            >
                <NFTView id={id} data={data} />
            </CardContent>,

            <CardContent
                key={"view-3"}
                style={STYLE_CARDCONTENT_3}
            >
                <AutoSizer disableHeight>
                    {({ width }) => (
                        <VirtualizedList
                            noRowsRenderer={NOOP}
                            scrollToIndex={NOOP}
                            height={160}
                            overscanRowCount={1}
                            rowCount={this._getAuthorsEntries().length}
                            rowHeight={72}
                            rowRenderer={this._votesRenderer}
                            width={width}
                        />
                    )}
                </AutoSizer>
            </CardContent>
        ];

        return this._cachedViews;
    }

    render() {
        const {
            classes,
            open,
            data,
            metadata,
            locales,
            renderer,
            mode,
            _hidden,
            _hidden2,
            _tab_value,
            _view_element_measurement,
            _size,
            zoom,
            _zoom_mode,
            _authors,
            _view_mobile_opened,
            _view_right_mobile_enabled,
            _license_dialog_opened,
            _license_base,
            _license_customization,
            _download_loading,
            kb,
            type,
            _comments,
            _voted,
            _initialVoted,
            _upvoteLoading,
            _downvoteLoading,
            _comment_sending,
            _reply_target,
        } = this.st4te;

        // Delta from initial state — avoids double-counting votes already in data.upVotesNumber
        const upVotesNumber = (data.upVotesNumber || 0) + (_voted === 1 ? 1 : 0) - (_initialVoted === 1 ? 1 : 0);
        const downVotesNumber = (data.downVotesNumber || 0) + (_voted === -1 ? 1 : 0) - (_initialVoted === -1 ? 1 : 0);
        const upVotesText = upVotesNumber + " Up-vote" + ((upVotesNumber > 1) ? "s" : "");
        const downVotesText = downVotesNumber + " Down-vote" + ((downVotesNumber > 1) ? "s" : "");
        const payout = parseFloat((data.payout || "0$").replace("$", "")) || 0.0;

        const tab_value = (_view_mobile_opened || !_view_right_mobile_enabled) ? _tab_value: 0;

        /* FIX: On mobile the bottom action bars should span full width with
         * squared bottom corners so they sit flush against the screen edge. */
        const _bottomBarRadius = _view_right_mobile_enabled ? "24px 24px 0px 0px" : "42px";
        const _bottomBarWidth = _view_right_mobile_enabled ? "100%" : "calc(100% - 16px)";
        const _data = {
            image: data.image,
            title: data.title,
            author: (data.author || {}).username
        };

        return (
            <Portal>
                <Backdrop keepMounted={true}
                          open={open}
                          className={classes.backdrop}>
                    <div style={STYLE_ROOT_CONTAINER} >
                        <div className={classes.viewLeft}
                             ref={this._setViewRef}
                        >
                            <div style={STYLE_CLOSE_OVERLAY} onClick={this._onRequestClose}></div>
                            <div style={STYLE_DOWNLOAD_WRAP}>
                                <IconButton onClick={this._download_with_watermark} >
                                    <CloudDownload />
                                </IconButton>
                                {_download_loading && <CircularProgress thickness={3} size={64} classes={{ circle: classes.circle }} className={classes.downloadButtonProgress} />}
                            </div>
                            <Fade in timeout={900}>
                                <div className={classes.back} onClick={this._handleArrowPrev}>
                                    <ArrowForwardIosIcon style={STYLE_ARROW_PREV} className={classes.arrowIcon} />
                                </div>
                            </Fade>
                            <Fade in timeout={900}>
                                <div className={classes.forward} onClick={this._handleArrowNext}>
                                    <ArrowForwardIosIcon className={classes.arrowIcon} />
                                </div>
                            </Fade>
                            {/* OPT #9: Added contain:strict on blur overlay wrapper */}
                            {/* PERF #10: translate3d for GPU composite, removed canvas key to reuse DOM */}
                            <div ref={this._setImageRef}
                                 style={{
                                     contain: "layout style",
                                     willChange: this._dragging ? "transform": "auto",
                                     position: "fixed",
                                     transform: `translate3d(calc(${this._posLeft}px - 50%), calc(${this._posTop}px - 50%), 0) scale(${(this._currentZoom / 3).toFixed(4)})`,
                                     transformOrigin: "50% 50%",
                                     userSelect: "none", touchAction: "none", pointerEvents: "none",
                                     cursor: this._dragging ? "grabbing" : "grab",
                                 }}>
                                <div
                                    className={
                                        this._navDismissing ? classes.dismiss :
                                            (this._navBouncing && !_hidden) ? classes.bounceAppear :
                                                (this._heroAnimating && !_hidden) ? classes.heroAppear :
                                                    (_hidden ? classes.hidden : classes.appear)
                                    }
                                    style={STYLE_IMG_ANIM_INNER}>
                                    {/* PERF #10: content-visibility:auto on blur overlays — browser can skip rendering when offscreen */}
                                    <img src={data.image} style={STYLE_BLUR_1} />
                                    <img src={data.image} style={STYLE_BLUR_2} />
                                    {/* PERF #10: Removed key={data.id} — reuses canvas DOM element instead of destroying/recreating it.
                                     * Canvas is cleared and resized in _set_imgd, no DOM churn needed. */}
                                    <canvas onContextMenu={this._bound_preventContextMenu} className={(renderer === "square" ? "pixelated" : "")} ref={this.setCanvasRef} style={{ zIndex: 1, userSelect: "none", touchAction: "none", pointerEvents: "initial", width: _size.width * 2, height: _size.height * 2, borderRadius: (renderer === "xbrz") ? `${128 / window.devicePixelRatio / zoom | 0}px` : "0px" }} />
                                </div>
                            </div>
                        </div>
                        {
                            <div className={
                                (_hidden2 && !this._drawerHasAppeared)
                                    ? classes.viewRightPrerender
                                    : (_view_mobile_opened || !_view_right_mobile_enabled)
                                        ? (this._drawerHasAppeared ? classes.viewRightNoAnim : classes.viewRight)
                                        : (this._drawerHasAppeared ? classes.viewRightHiddenNoDelay : classes.viewRightHidden)
                            }>
                                <Card ref={this._setMenuCardRef} className={classes.card + ((open && _view_mobile_opened) ? " opened " : " closed ") + (open ? " visible " : " hidden ")} >
                                    <Collapse timeout={COLLAPSE_TIMEOUT} in={tab_value < 1} className={classes.collapse}>
                                        <CardHeader
                                            className={classes.cardHeader}
                                            avatar={<Fade in={!_hidden2} timeout={FADE_TIMEOUT_AVATAR} key={_hidden2 ? "0": "1"}><Avatar src={(data.author || {}).image} onClick={this._bound_openAuthorFromData} /></Fade>}
                                            action={
                                                <IconButton onClick={this._bound_menuToggle}>
                                                    {
                                                        (_view_mobile_opened || !_view_right_mobile_enabled) ?
                                                            <CloseIcon style={STYLE_ICON_GRAY} /> :
                                                            <InfoOutlined style={STYLE_ICON_GRAY} />
                                                    }
                                                </IconButton>
                                            }
                                            title={<Fade in={!_hidden2} timeout={FADE_TIMEOUT_TITLE} key={_hidden2 ? "0": "1"}><span>{data.title}</span></Fade>}
                                            subheader={
                                                <Fade in={!_hidden2} timeout={FADE_TIMEOUT_SUBHEADER} key={_hidden2 ? "0": "1"}>
                                                <span>
                                                    <Tooltip arrow title={new Date(data.date).toLocaleDateString(locales, {
                                                        weekday: 'long',
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                        hour: 'numeric',
                                                        minute: 'numeric'
                                                    })}>
                                                        <span className={classes.subheaderDate}>{timeAgo.format(new Date(data.date || Date.now()))}</span>
                                                    </Tooltip>
                                                    <span className={classes.subheaderBy}> by </span>
                                                    <Tooltip title={"@" + (data.author || {}).username}>
                                                        <span className={classes.subheaderName} onClick={this._bound_openAuthorFromData}>{(data.author || {}).name}</span>
                                                    </Tooltip>
                                                </span>
                                                </Fade>
                                            } />
                                    </Collapse>
                                    <Fade in={!_hidden2} timeout={FADE_TIMEOUT_TABS} key={_hidden2 ? "0": "1"}>
                                        <Tabs
                                            style={{ transform: `translateY(${(tab_value < 1) ? 72 : 16}px)` }}
                                            className={classes.cardTabs}
                                            value={tab_value}
                                            variant="fullWidth"
                                            indicatorColor="primary"
                                            textColor="primary"
                                            onChange={this._handleTabChange}
                                            fullwidth={true}
                                        >
                                            <Tab icon={<DescriptionRounded />} />
                                            <Tab icon={<CommentRounded />} />
                                            <Tab icon={<LabelRounded />} />
                                        </Tabs>
                                    </Fade>
                                    <Fade in={!_hidden2} timeout={FADE_TIMEOUT_SWIPEABLE} key={_hidden2 ? "0": "1"}>
                                        <SwipeableViews
                                            ignoreNativeScroll={true}
                                            containerStyle={SWIPEABLE_CONTAINER_STYLE}
                                            animateHeight={false}
                                            animateTransitions={true}
                                            disableLazyLoading={true}
                                            resistance={true}
                                            springConfig={SWIPEABLE_SPRING}
                                            index={tab_value}
                                            onChangeIndex={this._bound_onChangeIndex}
                                            disabled={false}
                                            key={"swipe-able-view"}
                                        >
                                            {this._get_views()}
                                        </SwipeableViews>
                                    </Fade>
                                    <Fade in={tab_value === 0 && !_hidden2} timeout={400}>
                                        <PaperCardActions
                                            style={{ borderRadius: _bottomBarRadius, backgroundColor: "#101010", position: "fixed", bottom: 0, width: _bottomBarWidth }}
                                            upvoteLoading={_upvoteLoading}
                                            downvoteLoading={_downvoteLoading}
                                            voted={_voted}
                                            handleUpvote={this._upvote_toggle}
                                            handleDownvote={this._downvote_toggle}
                                            upVotesNumber={upVotesNumber}
                                            downVotesNumber={downVotesNumber}
                                            triggerPositiveVotes={this._trigger_positive_votes}
                                            triggerNegativeVotes={this._trigger_negative_votes}
                                            payout={payout}
                                            data={data}
                                        />
                                    </Fade>
                                    <Fade in={tab_value === 1 && !_hidden2} timeout={400}>
                                        <div style={{ borderRadius: _bottomBarRadius, backgroundColor: "#101010", position: "fixed", bottom: 0, width: _bottomBarWidth, padding: _reply_target ? "8px 16px 12px" : "12px 16px" }}>
                                            {_reply_target && (
                                                <div style={STYLE_REPLY_ROW}>
                                                    <Typography variant="caption" style={STYLE_REPLY_CAPTION}>
                                                        Replying to <span style={STYLE_REPLY_USERNAME}>@{_reply_target.username || (_reply_target.author || {}).username}</span>
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        style={STYLE_REPLY_CLOSE_BTN}
                                                        onClick={this._bound_clearReplyTarget}
                                                    >
                                                        <CloseIcon style={STYLE_REPLY_CLOSE_ICON} />
                                                    </IconButton>
                                                </div>
                                            )}
                                            <Grid container spacing={1} alignItems="center">
                                                <Grid item>
                                                    <Avatar style={STYLE_COMMENT_AVATAR} src={((this.st4te._accounts || {})[this.st4te.account] || (this.st4te._authors || {})[this.st4te.account] || {}).image || ""} />
                                                </Grid>
                                                <Grid item xs>
                                                    <TextField
                                                        fullWidth={true}
                                                        autoFocus={tab_value === 1}
                                                        type={"text"}
                                                        className={classes.comment}
                                                        id="comment-textfield"
                                                        name="comment-textfield"
                                                        label={_reply_target
                                                            ? `Reply to @${_reply_target.username || (_reply_target.author || {}).username}`
                                                            : `Reply to @${(data.author || {}).username}`}
                                                        disabled={_comment_sending}
                                                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this._handleSubmitComment(); } }}
                                                    />
                                                </Grid>
                                                <Grid item>
                                                    <IconButton
                                                        className={classes.commentSendButton}
                                                        onClick={this._handleSubmitComment}
                                                        disabled={_comment_sending}
                                                    >
                                                        {_comment_sending ? <CircularProgress size={24} style={{ color: "#888" }} /> : <SendRounded />}
                                                    </IconButton>
                                                </Grid>
                                            </Grid>
                                        </div>
                                    </Fade>
                                    <Fade in={tab_value === 2 && !_hidden2} timeout={400}>
                                        <div style={{ borderRadius: _bottomBarRadius, backgroundColor: "#101010", position: "fixed", bottom: 0, width: _bottomBarWidth, padding: "12px 16px" }}>
                                            <Grid container spacing={1} alignItems="center">
                                                {availableEditions.length > 0 ? (
                                                    <>
                                                        <Grid item xs>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                                <div>
                                                                    <Typography variant="caption" style={{ color: "#888", display: "block" }}>
                                                                        Best Price
                                                                    </Typography>
                                                                    <Typography variant="h6" style={{ color: "#fff", fontWeight: "bold" }}>
                                                                        {floorPrice} {currency}
                                                                    </Typography>
                                                                </div>
                                                                <div>
                                                                    <Typography variant="caption" style={{ color: "#888", display: "block" }}>
                                                                        Available
                                                                    </Typography>
                                                                    <Typography variant="body2" style={{ color: "#ffffff" }}>
                                                                        {availableEditions.length} editions
                                                                    </Typography>
                                                                </div>
                                                            </div>
                                                        </Grid>
                                                        <Grid item>
                                                            <Button
                                                                variant="contained"
                                                                style={{
                                                                    backgroundColor: "#fff",
                                                                    color: "#000",
                                                                    fontWeight: "bold",
                                                                    minWidth: 120
                                                                }}
                                                            >
                                                                Buy Now
                                                            </Button>
                                                        </Grid>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Grid item xs>
                                                            <div>
                                                                <Typography variant="body2" style={{ color: "#888" }}>
                                                                    No editions for sale
                                                                </Typography>
                                                                <Typography variant="caption" style={{ color: "#666" }}>
                                                                    Make an offer to all holders
                                                                </Typography>
                                                            </div>
                                                        </Grid>
                                                        <Grid item>
                                                            <Button
                                                                variant="contained"
                                                                style={{
                                                                    backgroundColor: "#ffffff",
                                                                    color: "#fff",
                                                                    fontWeight: "bold",
                                                                    minWidth: 120
                                                                }}
                                                            >
                                                                Make Offer
                                                            </Button>
                                                        </Grid>
                                                    </>
                                                )}
                                            </Grid>
                                        </div>
                                    </Fade>
                                </Card>
                            </div>}
                    </div>
                    <LicenseDialog
                        open={_license_dialog_opened}
                        onClose={this._handle_close_license_dialog}
                        licenseBase={_license_base}
                        customization={_license_customization}
                        data={_data}
                    />
                </Backdrop>
            </Portal>
        );
    }
}

export default withStyles(styles)(PostDialog);