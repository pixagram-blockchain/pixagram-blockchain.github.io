import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import TouchAppIcon from "@material-ui/icons/TouchApp";
import PaletteIcon from "@material-ui/icons/Palette";
import MoodIcon from "@material-ui/icons/Mood";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import EmojiObjectsIcon from "@material-ui/icons/EmojiObjects";
import SchoolIcon from "@material-ui/icons/School";
import GroupAddIcon from "@material-ui/icons/GroupAdd";
import GavelIcon from "@material-ui/icons/Gavel";
import ThumbsUpDownIcon from "@material-ui/icons/ThumbsUpDown";
import SecurityIcon from "@material-ui/icons/Security";
import FaceIcon from "@material-ui/icons/Face";
import VisibilityIcon from "@material-ui/icons/Visibility";
import AccountBalanceIcon from "@material-ui/icons/AccountBalance";
import BuildIcon from "@material-ui/icons/Build";
import DeviceHubIcon from "@material-ui/icons/DeviceHub";
import CallSplitIcon from "@material-ui/icons/CallSplit";
import VerifiedUserIcon from "@material-ui/icons/VerifiedUser";
import FitnessCenterIcon from "@material-ui/icons/FitnessCenter";
import { t } from "../utils/text";

const styles = theme => ({
    root: {
        width: "100%",
    },
    epigraph: {
        margin: "0px 0px 20px 0px",
        fontSize: theme.typography.pxToRem(15),
        lineHeight: 1.6,
        color: "rgba(255,255,255,0.9)",
        textAlign: "center",
        fontFamily: `"Industry Book", "Normative Pro"`,
        fontWeight: 600,
    },
    foreword: {
        margin: "0px 0px 8px 0px",
        fontSize: theme.typography.pxToRem(14),
        lineHeight: 1.6,
        color: "rgba(255,255,255,0.7)",
    },
    sectionTitle: {
        margin: "24px 0px 2px 0px",
        fontSize: "24px",
        opacity: 1,
        fontFamily: `"Industry Book", "Normative Pro"`
    },
    subtitle: {
        margin: "0px 0px 8px 0px",
        fontSize: theme.typography.pxToRem(13),
        color: "rgba(255,255,255,0.5)",
        fontStyle: "italic",
    },
    principle: {
        display: "flex",
        alignItems: "flex-start",
        padding: "12px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
    },
    principleIcon: {
        color: "rgba(255,255,255,0.5)",
        fontSize: "20px",
        marginRight: "12px",
        marginTop: "1px",
        flexShrink: 0,
    },
    principleText: {
        fontSize: theme.typography.pxToRem(14),
        lineHeight: 1.6,
        color: "rgba(255,255,255,0.8)",
    },
    principleLead: {
        fontWeight: 600,
        color: "rgba(255,255,255,0.95)",
        fontFamily: `"Industry Book", "Normative Pro"`
    },
    closing: {
        margin: "24px 0px 0px 0px",
        padding: "0px 8px",
        fontSize: theme.typography.pxToRem(14),
        lineHeight: 1.6,
        color: "rgba(255,255,255,0.7)",
        textAlign: "center",
        fontFamily:`"Industry Book", "Normative Pro"`,
        fontWeight: 600,
    },
});

// Values are translation KEYS, not prose. This array is evaluated once at
// import time, so calling t() here would pin the language to module load.
// The render methods resolve with t(key). See utils/text.js.
const PRINCIPLE_SECTIONS = [
    {
        title: "components.community_principles.for_the_participants",
        subtitle: "components.community_principles.creators_curators_stakeholders",
        items: [
            {
                icon: TouchAppIcon,
                lead: "components.community_principles.the_active_hand_is_the_backbone",
                rest: "components.community_principles.to_create_and_to_curate_is_worth"
            },
            {
                icon: PaletteIcon,
                lead: "components.community_principles.nothing_is_beautiful_but_the_artworks",
                rest: "components.community_principles.and_most_beautiful_of_all_are_the"
            },
            {
                icon: MoodIcon,
                lead: "components.community_principles.create_first_for_your_own_joy",
                rest: "components.community_principles.and_only_then_refine_your_work_to"
            },
            {
                icon: TrendingUpIcon,
                lead: "components.community_principles.strive_not_only_forwards_but_upwards",
                rest: "components.community_principles.for_greatness_lies_in_the_highest_to"
            },
            {
                icon: EmojiObjectsIcon,
                lead: "components.community_principles.let_the_love_of_beautiful_artworks_be",
                rest: "components.community_principles.but_let_your_highest_goal_be_their"
            },
            {
                icon: SchoolIcon,
                lead: "components.community_principles.strive_ever_for_learning_and_improvement",
                rest: "components.community_principles.for_conquest_is_never_accomplished_no_milestone"
            },
            {
                icon: GroupAddIcon,
                lead: "components.community_principles.all_that_is_great_is_built_upon",
                rest: "components.community_principles.lift_the_smallest_accounts_as_you_climb"
            },
            {
                icon: GavelIcon,
                lead: "components.community_principles.discard_not_popularity",
                rest: "components.community_principles.but_treat_it_sometimes_as_an_impostor"
            },
            {
                icon: ThumbsUpDownIcon,
                lead: "components.community_principles.withhold_your_praise_as_freely_as_you",
                rest: "components.community_principles.to_dislike_is_your_right_and_to"
            },
            {
                icon: SecurityIcon,
                lead: "components.community_principles.protect_the_young_and_harass_no_one",
                rest: "components.community_principles.a_community_is_known_by_how_it"
            },
            {
                icon: FaceIcon,
                lead: "components.community_principles.this_network_is_made_for_human_eyes",
                rest: "components.community_principles.let_every_tool_serve_the_creator_and"
            },
            {
                icon: VisibilityIcon,
                lead: "components.community_principles.reject_illusion_and_lies",
                rest: "components.community_principles.in_your_work_and_in_your_dealings"
            },
        ],
    },
    {
        title: "components.community_principles.for_the_community",
        subtitle: "components.community_principles.marketers_developers_the_system",
        items: [
            {
                icon: AccountBalanceIcon,
                lead: "components.community_principles.pixa_is_built_not_upon_sand_but",
                rest: "components.community_principles.contribute_to_it_not_for_today_or"
            },
            {
                icon: BuildIcon,
                lead: "components.community_principles.the_dpf_builds_and_builds_only",
                rest: "components.community_principles.it_funds_development_and_the_protocol_the"
            },
            {
                icon: DeviceHubIcon,
                lead: "components.community_principles.no_single_hand_owns_this_network",
                rest: "components.community_principles.the_foundation_stewards_it_does_not_rule"
            },
            {
                icon: CallSplitIcon,
                lead: "components.community_principles.the_code_is_open_and_the_door",
                rest: "components.community_principles.should_governance_ever_fail_the_community_may"
            },
            {
                icon: VerifiedUserIcon,
                lead: "components.community_principles.hide_no_problem_and_promise_no_more",
                rest: "components.community_principles.what_is_true_is_said_plainly_even"
            },
            {
                icon: FitnessCenterIcon,
                lead: "components.community_principles.what_does_not_break_the_network_strengthens",
                rest: "components.community_principles.we_endure_by_bending_to_the_storm"
            },
        ],
    },
];

class CommunityPrinciples extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
        };
    };

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    componentWillReceiveProps(nextProps, nextContext) {

        this.setState(nextProps, this.forceUpdate);
    }

    _render_item = (section_index, item_index, item) => {
        const { classes } = this.state;
        const key = "principle-" + section_index + "-" + item_index;
        const Icon = item.icon;

        return (
            <div key={key} className={classes.principle}>
                {Icon && <Icon className={classes.principleIcon} />}
                <Typography className={classes.principleText}>
                    <span className={classes.principleLead}>{t(item.lead)}</span>{t(item.rest)}
                </Typography>
            </div>
        );
    };

    _render_section = (section, section_index) => {
        const { classes } = this.state;

        return (
            <div key={"section-" + section_index}>
                <h2 className={classes.sectionTitle}>{t(section.title)}</h2>
                <Typography className={classes.subtitle}>{t(section.subtitle)}</Typography>
                {section.items.map((item, i) => this._render_item(section_index, i, item))}
            </div>
        );
    };

    render() {

        const { classes } = this.state;

        return (
            <div className={classes.root}>
                <Typography className={classes.epigraph}>Uniquely we are free; together we are stronger.</Typography>
                <Typography className={classes.foreword}>These principles are the foundation of Pixa, and of the community we build upon it — honest, fair, enduring, and united. The protocol forbids only what it must; everything good beyond that line is the character we choose. This is that character: the spirit in which we create, the way we treat one another, and the measure we hold ourselves to. They bind no one by force, and yet they bind us all.</Typography>
                {PRINCIPLE_SECTIONS.map((section, i) => this._render_section(section, i))}
                <Typography className={classes.closing}>Free in our hands, united in our purpose — <span style={{color: "rgba(255,255,255,1.0)"}}>we build for all time.</span></Typography>
            </div>
        );
    }
}

export default withStyles(styles)(CommunityPrinciples);