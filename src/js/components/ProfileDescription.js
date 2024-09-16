import * as React from "preact/compat";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Typography from "@material-ui/core/Typography";
import RoomRounded from "@material-ui/icons/RoomRounded";
import LinkRounded from "@material-ui/icons/LinkRounded";
import CalendarTodayRounded from "@material-ui/icons/CalendarTodayRounded";
import { safeHttpUrl } from "../utils/safeUrl";

import { t, getLocaleCode, useLanguage } from "../utils/text";

// Contact values are handles, not URLs — a Threema ID is not a website. Only the
// two unambiguous cases become links; everything else stays inert text.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s().-]{5,24}$/;
const contactHref = (value) => {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    if (EMAIL_RE.test(v)) return `mailto:${v}`;
    if (PHONE_RE.test(v)) return `tel:${v.replace(/[\s().-]/g, '')}`;
    return null;
};

/**
 * Extract extended profile fields (links, addresses, contacts) from the
 * sanitized JSON metadata strings stored on the account entity.
 * posting_json_metadata takes priority over json_metadata.
 *
 * Data format from pixaproxyapi / EditProfileDialog:
 *   profile.links     = [ { id, name, value }, ... ]
 *   profile.addresses = [ { id, name, value }, ... ]
 */
const parseExtendedProfile = (account) => {
    let postingMeta = {};
    let jsonMeta = {};
    try { postingMeta = JSON.parse(account?.posting_json_metadata || '{}'); } catch (e) {}
    try { jsonMeta = JSON.parse(account?.json_metadata || '{}'); } catch (e) {}

    const profile = { ...(jsonMeta.profile || {}), ...(postingMeta.profile || {}) };

    // id is preserved for React keys — names are user-supplied and routinely
    // duplicated ("Telegram" twice), which silently breaks list reconciliation.
    const toItems = (raw, prefix) => (Array.isArray(raw) ? raw : [])
        .filter(item => item && typeof item === 'object' && item.name && item.value)
        .map((item, i) => ({
            key: String(item.id || `${prefix}-${i}`),
            name: String(item.name),
            value: String(item.value)
        }));

    return {
        links:     toItems(profile.links, 'link'),
        addresses: toItems(profile.addresses, 'addr'),
        contacts:  toItems(profile.contacts, 'contact')
    };
};

const ProfileDescription = React.memo(({ classes, account }) => {
    useLanguage();
    // Use sanitized _profile.* fields from API entity
    const description = account?._profile?.about || '';
    const location = account?._profile?.location || '';
    const website = account?._profile?.website || '';
    // created is an integer ms timestamp from the sanitization pipeline
    const created = account?.created;

    // Parse extended profile data from JSON metadata
    const { links, addresses, contacts } = parseExtendedProfile(account);

    // Format creation date from ms timestamp
    const formatCreatedDate = (ts) => {
        if (!ts) return null;
        try {
            const date = new Date(ts);
            if (isNaN(date.getTime())) return null;
            return date.toLocaleDateString(getLocaleCode(), {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return null;
        }
    };

    const createdFormatted = formatCreatedDate(created);

    // Check if there's any content to display
    const hasDescription = description && description.trim().length > 0;
    const hasLocation = location && location.trim().length > 0;
    const hasWebsite = website && website.trim().length > 0;
    const hasCreated = createdFormatted !== null;
    const hasLinks = links.length > 0;
    const hasAddresses = addresses.length > 0;
    const hasContacts = contacts.length > 0;
    const websiteHref = hasWebsite ? safeHttpUrl(website) : null;
    const hasAnyContent = hasDescription || hasLocation || hasWebsite || hasCreated || hasLinks || hasAddresses || hasContacts;

    if (!hasAnyContent) {
        return (
            <List dense>
                <ListSubheader disableSticky className={classes.metaListHeader}>
                    {t("components.profile_description.about")}
                </ListSubheader>
                <ListItem>
                    <ListItemText
                        secondary={
                            <Typography style={{fontSize: "12px", color: "#888", lineHeight: "1rem", fontStyle: "italic"}} component="span" variant="body1">
                                {t("components.profile_description.no_profile_information_available")}
                            </Typography>
                        }
                    />
                </ListItem>
            </List>
        );
    }

    return (
        <List dense>
            {(hasDescription || hasLocation || hasWebsite || hasCreated) && (
                <ListSubheader disableSticky className={classes.metaListHeader}>
                    {t("components.profile_description.about")}
                </ListSubheader>
            )}
            {hasDescription && (
                <ListItem>
                    <ListItemText
                        secondary={
                            <Typography style={{fontSize: "12px", color: "#ccc", lineHeight: "1.4rem"}} component="span" variant="body1">
                                {description}
                            </Typography>
                        }
                    />
                </ListItem>
            )}
            {hasLocation && (
                <ListItem>
                    <ListItemIcon style={{minWidth: 32}}>
                        <RoomRounded style={{color: "#888"}}/>
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Typography style={{cursor: "pointer", lineHeight: "1.618rem", display: "block", fontWeight: "bold", fontSize: "14px", color: "#fff"}} component="span" variant="body2">
                                {location}
                            </Typography>
                        }
                    />
                </ListItem>
            )}
            {hasWebsite && (
                <ListItem
                    {...(websiteHref
                        ? { button: true, component: "a", href: websiteHref, target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                >
                    <ListItemIcon style={{minWidth: 32}}>
                        <LinkRounded style={{color: "#888"}}/>
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Typography style={{lineHeight: "1.618rem", display: "block", fontWeight: "bold", fontSize: "14px", color: "#dadada"}} component="span" variant="body2">
                                {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            </Typography>
                        }
                    />
                </ListItem>
            )}
            {hasLinks && (
                <React.Fragment>
                    <ListSubheader disableSticky className={classes.metaListHeader}>
                        {t("words.links")}
                    </ListSubheader>
                    {links.map((item) => {
                        const href = safeHttpUrl(item.value);
                        return (
                            <ListItem
                                key={item.key}
                                {...(href
                                    ? { button: true, component: "a", href, target: "_blank", rel: "noopener noreferrer" }
                                    : {})}
                            >
                                <ListItemText
                                    primary={
                                        <Typography style={{cursor: "pointer", lineHeight: "1.618rem", display: "block", fontWeight: "bold", fontSize: "14px", color: "#fff"}} component="span" variant="body2">
                                            {item.name}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography style={{fontSize: "12px", color: "#dadada", lineHeight: "1rem"}} component="span" variant="body1">
                                            {item.value}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        );
                    })}
                </React.Fragment>
            )}
            {hasAddresses && (
                <React.Fragment>
                    <ListSubheader disableSticky className={classes.metaListHeader}>
                        {t("components.profile_description.crypto_addresses")}
                    </ListSubheader>
                    {addresses.map((item) => (
                        <ListItem key={item.key}>
                            <ListItemText
                                primary={
                                    <Typography style={{cursor: "pointer", lineHeight: "1.618rem", display: "block", fontWeight: "bold", fontSize: "14px", color: "#fff"}} component="span" variant="body2">
                                        {item.name}
                                    </Typography>
                                }
                                secondary={
                                    <Typography
                                        style={{
                                            fontSize: "11px",
                                            color: "#ccc",
                                            lineHeight: "1rem",
                                            wordBreak: "break-all",
                                            fontFamily: "monospace"
                                        }}
                                        component="span"
                                        variant="body1"
                                    >
                                        {item.value}
                                    </Typography>
                                }
                            />
                        </ListItem>
                    ))}
                </React.Fragment>
            )}
            {hasContacts && (
                <React.Fragment>
                    <ListSubheader disableSticky className={classes.metaListHeader}>
                        {t("words.contact_info")}
                    </ListSubheader>
                    {contacts.map((item) => {
                        const href = contactHref(item.value);
                        return (
                            <ListItem
                                key={item.key}
                                {...(href ? { button: true, component: "a", href, rel: "noopener noreferrer" } : {})}
                            >
                                <ListItemText
                                    primary={
                                        <Typography style={{lineHeight: "1.618rem", display: "block", fontWeight: "bold", fontSize: "14px", color: "#fff"}} component="span" variant="body2">
                                            {item.name}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography style={{fontSize: "12px", color: "#dadada", lineHeight: "1rem", wordBreak: "break-all"}} component="span" variant="body1">
                                            {item.value}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        );
                    })}
                </React.Fragment>
            )}
        </List>
    );
});

export default ProfileDescription;