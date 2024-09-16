import * as React from "preact/compat";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tooltip from "@material-ui/core/Tooltip";
import List from "@material-ui/core/List";
import ListSubheader from "@material-ui/core/ListSubheader";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ScheduleRounded from "@material-ui/icons/ScheduleRounded";
import DescriptionRounded from "@material-ui/icons/DescriptionRounded";
import SecurityRounded from "@material-ui/icons/SecurityRounded";
import CakeRounded from "@material-ui/icons/CakeRounded";

import { t, tnode, getLocaleCode, useLanguage } from "../utils/text";

const MANA_REGEN_SECONDS = 5 * 24 * 3600; // 5 days full regeneration

const FULL_DATE_OPTS = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
};

/**
 * Recalculate current mana accounting for regeneration since last update.
 */
const calculateCurrentMana = (manabar, maxMana) => {
    if (!manabar || !maxMana || maxMana <= 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    const elapsed = Math.max(0, now - (Number(manabar.last_update_time) || 0));
    const currentMana = Number(manabar.current_mana) || 0;
    const regenerated = (maxMana * elapsed) / MANA_REGEN_SECONDS;
    return Math.min(100, ((Math.min(maxMana, currentMana + regenerated)) / maxMana) * 100);
};

/**
 * Get the most recent "last active" timestamp from account data.
 */
const getLastActive = (account) => {
    if (!account) return null;
    const EPOCH_THRESHOLD = 86400000;
    const candidates = [
        account.last_post,
        account.last_vote_time,
        account.last_account_update,
    ].filter(ts => typeof ts === 'number' && ts > EPOCH_THRESHOLD);
    if (candidates.length === 0) return null;
    return Math.max(...candidates);
};

/**
 * Get the account creation timestamp (ms). Accepts either a numeric ms value
 * or an ISO-ish string (e.g. "2016-03-24T17:00:00") as returned by the
 * blockchain. Returns null when no usable value is present.
 */
const getCreatedTime = (account) => {
    if (!account) return null;
    const raw = account.created;
    if (typeof raw === 'number' && raw > 86400000) return raw;
    if (typeof raw === 'string' && raw.length > 0) {
        // Blockchain timestamps are UTC but often lack the trailing 'Z'.
        const iso = /[zZ]|[+\-]\d{2}:?\d{2}$/.test(raw) ? raw : raw + 'Z';
        const ms = Date.parse(iso);
        return Number.isFinite(ms) ? ms : null;
    }
    return null;
};

/**
 * A single circular power gauge.
 * Matches the DOM structure targeted by the votingPower CSS class:
 *   Box > Box > CircularProgress
 *   Box > Typography.colorTextSecondary
 *
 * @param {number} value           The numeric value to display.
 * @param {string} label           Caption shown below the ring.
 * @param {number} [progressValue] Optional 0-100 value driving the ring fill
 *                                 when it differs from `value` (e.g. reputation,
 *                                 where the displayed number is not a percent
 *                                 but the ring still needs a normalised fill).
 * @param {function} [format]      Optional formatter; defaults to "NN%".
 */
const PowerGauge = React.memo(({ value, label, progressValue, format }) => {
    useLanguage();
    const ringValue = Math.min(100, Math.max(0, progressValue != null ? progressValue : value));
    const displayText = format ? format(value) : `${Math.min(100, Math.max(0, value)).toFixed(0)}%`;
    return (
        <Box position="relative" display="inline-flex" flexDirection="column" alignItems="center">
            <Box position="relative" display="inline-flex">
                <CircularProgress
                    variant="static"
                    value={ringValue}
                    size={56}
                    thickness={4}
                />
                <Box
                    top={0} left={0} bottom={0} right={0}
                    position="absolute" display="flex"
                    alignItems="center" justifyContent="center"
                >
                    <Typography variant="caption" component="div" style={{fontSize: "11px", color: "#ccc", fontFamily: "Geist Mono, monospace"}}>
                        {displayText}
                    </Typography>
                </Box>
            </Box>
            <Typography variant="caption" color="textSecondary" style={{marginTop: "8px"}}>
                {label}
            </Typography>
        </Box>
    );
});

const VotingPowerDisplay = React.memo(({ classes, timeAgo, postsCount, account, vpMana, rcMana }) => {
    useLanguage();

    // --- Voting Power ---
    let vpPercentage = 0;
    if (vpMana && typeof vpMana.percentage === 'number') {
        vpPercentage = vpMana.percentage / 100;
    } else if (account?.voting_manabar && vpMana?.max_mana) {
        vpPercentage = calculateCurrentMana(account.voting_manabar, Number(vpMana.max_mana));
    }

    // --- Downvote Power ---
    let downvotePercentage = 0;
    const maxVoteMana = vpMana?.max_mana ? Number(vpMana.max_mana) : 0;
    if (account?.downvote_manabar && maxVoteMana > 0) {
        downvotePercentage = calculateCurrentMana(account.downvote_manabar, maxVoteMana * 0.25);
    }

    // --- Resource Credits ---
    let rcPercentage = 0;
    if (rcMana && typeof rcMana.percentage === 'number') {
        rcPercentage = rcMana.percentage / 100;
    } else if (rcMana?.rc_manabar && rcMana?.max_rc) {
        rcPercentage = calculateCurrentMana(rcMana.rc_manabar, Number(rcMana.max_rc));
    }

    // --- Reputation ---
    // `reputation_score` is precomputed by FormatterAPI.reputation() (Hive
    // condenser canonical formula, integer, typically 25-80). Fall back to
    // 25 (neutral) if absent. The ring fill is driven by a soft 0-80 scale
    // since real-world scores rarely exceed 80; the displayed number itself
    // is the raw integer with no "%" suffix.
    const reputationScore = (typeof account?.reputation_score === 'number')
        ? account.reputation_score
        : 25;

    // --- Last Active ---
    const lastActiveTs = getLastActive(account);
    const lastActiveStr = lastActiveTs
        ? (timeAgo ? timeAgo.format(lastActiveTs, { labels: 'long' }) : new Date(lastActiveTs).toLocaleDateString(getLocaleCode()))
        : 'Never';
    const lastActiveFull = lastActiveTs
        ? new Date(lastActiveTs).toLocaleDateString(getLocaleCode(), FULL_DATE_OPTS)
        : null;

    // --- Joined ---
    const createdTs = getCreatedTime(account);
    const joinedStr = createdTs
        ? (timeAgo ? timeAgo.format(createdTs, { labels: 'long' }) : new Date(createdTs).toLocaleDateString(getLocaleCode()))
        : 'Unknown';
    const joinedFull = createdTs
        ? new Date(createdTs).toLocaleDateString(getLocaleCode(), FULL_DATE_OPTS)
        : null;

    const count = typeof postsCount === 'number' ? postsCount : (account?.post_count || 0);

    // Render a relative-time string as a Tooltip-wrapped span when a full
    // date is available; otherwise return the plain text. Avoids wrapping
    // 'Never' / 'Unknown' in a hover target that has nothing to reveal.
    //
    // The result goes through tnode(), never t(): t() is a string function and
    // deliberately leaves object-valued variables as literal "{{date}}" tokens.
    // Both return shapes are fine — tnode() splices the element and falls back
    // to plain interpolation for the bare-string case.
    const withDateTooltip = (text, fullDate) => fullDate ? (
        <Tooltip arrow title={fullDate}>
            <span style={{borderBottom: "1px dotted #555", cursor: "help"}}>{text}</span>
        </Tooltip>
    ) : text;

    return (
        <React.Fragment>
            <List dense>
                <ListSubheader disableSticky className={classes.metaListHeader}>
                    {t("components.voting_power_display.variables")}
                </ListSubheader>
            </List>
            <div className={classes.votingPower}>
                <PowerGauge value={vpPercentage} label={t("components.voting_power_display.upvote_power")} />
                <PowerGauge value={downvotePercentage} label={t("components.voting_power_display.downvote_power")} />
                <PowerGauge value={rcPercentage} label={t("components.voting_power_display.resource_credits")} />
            </div>
            <List dense>
                <ListSubheader disableSticky className={classes.metaListHeader}>
                    {t("components.voting_power_display.activity")}
                </ListSubheader>
                <ListItem>
                    <ListItemIcon style={{minWidth: 32}}>
                        <SecurityRounded style={{color: "#888", fontSize: "20px"}}/>
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Typography style={{lineHeight: "1.618rem", display: "block", fontSize: "13px", color: "#aaa"}} component="span" variant="body2">
                                {"Reputation: " + reputationScore}
                            </Typography>
                        }
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon style={{minWidth: 32}}>
                        <ScheduleRounded style={{color: "#888", fontSize: "20px"}}/>
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Typography style={{lineHeight: "1.618rem", display: "block", fontSize: "13px", color: "#aaa"}} component="span" variant="body2">{tnode("components.voting_power_display.last_active", {
                                date: withDateTooltip(lastActiveStr, lastActiveFull)
                            })}</Typography>
                        }
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon style={{minWidth: 32}}>
                        <CakeRounded style={{color: "#888", fontSize: "20px"}}/>
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Typography style={{lineHeight: "1.618rem", display: "block", fontSize: "13px", color: "#aaa"}} component="span" variant="body2">{tnode("components.voting_power_display.joined", {
                                date: withDateTooltip(joinedStr, joinedFull)
                            })}</Typography>
                        }
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon style={{minWidth: 32}}>
                        <DescriptionRounded style={{color: "#888", fontSize: "20px"}}/>
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Typography style={{lineHeight: "1.618rem", display: "block", fontSize: "13px", color: "#aaa"}} component="span" variant="body2">
                                {count} post{count !== 1 ? 's' : ''}
                            </Typography>
                        }
                    />
                </ListItem>
            </List>
        </React.Fragment>
    );
});

export default VotingPowerDisplay;