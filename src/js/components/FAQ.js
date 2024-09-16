import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import Typography from "@material-ui/core/Typography";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import { t } from "../utils/text";

const styles = theme => ({
    root: {
        width: "100%",
    },
    accordion: {
        backgroundColor: "transparent",
        boxShadow: "none",
        borderBottom: "1px solid rgba(255,255,255,0.2)",
        "&:before": {
            display: "none",
        },
        "&.Mui-expanded": {
            margin: 0,
        },
    },
    summary: {
        padding: "0px 8px",
        "& .MuiAccordionSummary-content": {
            flexDirection: "column",
            margin: "12px 0px",
        },
        "& .MuiAccordionSummary-content.Mui-expanded": {
            margin: "12px 0px",
        },
    },
    heading: {
        fontSize: theme.typography.pxToRem(15),
        fontWeight: 500,
    },
    secondaryHeading: {
        fontSize: theme.typography.pxToRem(13),
        color: "rgba(255,255,255,0.9)",
        marginTop: "2px",
        fontWeight: "400"
    },
    details: {
        padding: "0px 8px 16px 8px",
        display: "block",
    },
    detailsText: {
        fontSize: theme.typography.pxToRem(14),
        lineHeight: 1.6,
        color: "rgba(255,255,255,0.8)",
    },
    sectionTitle: {
        margin: "24px 0px 8px 0px",
        opacity: 1,
    },
    foreword: {
        margin: "0px 0px 16px 0px",
        fontSize: theme.typography.pxToRem(14),
        lineHeight: 1.6,
        color: "rgba(255,255,255,0.7)",
        fontStyle: "italic",
    },
});

// Values are translation KEYS, not prose. This array is evaluated once at
// import time, so calling t() here would pin the language to module load.
// The render methods resolve with t(key). See utils/text.js.
const FAQ_SECTIONS = [
    {
        title: "components.faq.i_what_pixagram_is",
        items: [
            {
                q: "components.faq.what_is_the_pixa_network",
                hint: "components.faq.a_public_ledger_and_a_social_platform",
                a: "components.faq.pixa_is_a_public_blockchain_that_hosts"
            },
            {
                q: "components.faq.what_is_pxa",
                hint: "components.faq.the_liquid_transferable_token_of_the_pixa",
                a: "components.faq.pxa_is_what_changes_hands_between_users"
            },
            {
                q: "components.faq.what_is_pxp",
                hint: "components.faq.the_staked_governance_bearing_form_of_pxa",
                a: "components.faq.pxp_is_the_same_value_as_pxa"
            },
            {
                q: "components.faq.what_is_pxs",
                hint: "components.faq.an_oracle_referenced_reward_token_attracted_to",
                a: "components.faq.pxs_is_the_reward_token_creators_receive"
            },
            {
                q: "components.faq.why_three_tokens",
                hint: "components.faq.each_does_something_the_others_cannot",
                a: "components.faq.pxa_is_liquid_and_tradeable_but_volatile"
            },
        ],
    },
    {
        title: "components.faq.ii_where_the_tokens_come_from",
        items: [
            {
                q: "components.faq.who_created_the_first_pxa",
                hint: "components.faq.no_one_pxa_only_emerges_from_protocol",
                a: "components.faq.at_the_moment_the_chain_starts_no"
            },
            {
                q: "components.faq.who_created_the_first_pxp",
                hint: "components.faq.the_genesis_block_once_and_only_once",
                a: "components.faq.the_genesis_block_creates_exactly_100_000"
            },
            {
                q: "components.faq.who_created_the_first_pxs",
                hint: "components.faq.the_protocol_seeded_a_community_treasury_at",
                a: "components.faq.at_genesis_the_protocol_seeds_250_000"
            },
            {
                q: "components.faq.who_controls_how_many_tokens_get_created",
                hint: "components.faq.no_one_in_particular_and_everyone_together",
                a: "components.faq.no_entity_has_a_button_to_press"
            },
        ],
    },
    {
        title: "components.faq.iii_how_pxs_is_attracted_to_a",
        items: [
            {
                q: "components.faq.what_does_attracted_mean_here",
                hint: "components.faq.geometry_not_gravity_no_hand_reaches_in",
                a: "components.faq.a_magnetic_field_does_not_push_any"
            },
            {
                q: "components.faq.where_does_the_reference_value_come_from",
                hint: "components.faq.21_witnesses_each_publishing_from_their_own",
                a: "components.faq.each_of_the_21_witnesses_publishes_hourly"
            },
            {
                q: "components.faq.why_the_big_mac_of_all_things",
                hint: "components.faq.a_real_thing_sold_by_one_company",
                a: "components.faq.the_big_mac_is_the_closest_publicly"
            },
            {
                q: "components.faq.what_happens_when_pxa_moves_in_price",
                hint: "components.faq.holders_are_insulated_from_pxa_volatility_in",
                a: "components.faq.if_pxa_appreciates_each_pxa_buys_more"
            },
            {
                q: "components.faq.what_is_the_haircut",
                hint: "components.faq.what_happens_when_the_system_is_stressed",
                a: "components.faq.if_total_outstanding_pxs_reference_value_grows"
            },
            {
                q: "components.faq.why_is_there_also_an_upper_bound",
                hint: "components.faq.above_10_000_the_protocol_pauses_new",
                a: "components.faq.when_pxa_becomes_so_abundant_relative_to"
            },
        ],
    },
    {
        title: "components.faq.iv_the_fears_addressed_directly",
        items: [
            {
                q: "components.faq.what_if_the_founders_just_print_themselves",
                hint: "components.faq.they_cannot_no_minting_key_exists",
                a: "components.faq.the_protocol_has_no_minting_key_held"
            },
            {
                q: "components.faq.what_if_the_founders_use_their_stake",
                hint: "components.faq.the_special_accounts_cannot_vote",
                a: "components.faq.the_two_genesis_allocation_accounts_pixa_rex"
            },
            {
                q: "components.faq.what_if_the_witnesses_collude",
                hint: "components.faq.they_serve_continuously_at_the_consent_of",
                a: "components.faq.witnesses_are_elected_continuously_by_pxp_voting"
            },
            {
                q: "components.faq.what_if_the_foundation_goes_rogue",
                hint: "components.faq.the_foundation_holds_no_tokens_and_no",
                a: "components.faq.the_pixa_foundation_does_not_hold_tokens"
            },
            {
                q: "components.faq.what_if_the_chain_just_dies",
                hint: "components.faq.honest_answer_the_protocol_is_the_counterparty",
                a: "components.faq.if_every_witness_simultaneously_stopped_producing_bl"
            },
            {
                q: "components.faq.what_if_my_pxs_becomes_worth_nothing",
                hint: "components.faq.the_protocol_does_not_defend_any_market",
                a: "components.faq.the_market_price_of_pxs_is_determined"
            },
            {
                q: "components.faq.what_if_regulators_come_after_the_network",
                hint: "components.faq.the_legal_architecture_distributes_exposure_delibera",
                a: "components.faq.pixa_operations_s_a_panama_performed_the"
            },
        ],
    },
    {
        title: "components.faq.v_the_decentralized_pixa_fund",
        items: [
            {
                q: "components.faq.what_is_pixa_omnibus",
                hint: "components.faq.the_community_treasury_for_everyone_owned_by",
                a: "components.faq.pixa_omnibus_is_the_decentralized_pixa_fund"
            },
            {
                q: "components.faq.who_holds_the_keys_to_pixa_omnibus",
                hint: "components.faq.no_one_the_keys_do_not_exist",
                a: "components.faq.the_account_has_no_owner_key_no"
            },
            {
                q: "components.faq.then_how_does_money_ever_leave_it",
                hint: "components.faq.through_the_proposal_mechanism_open_to_anyone",
                a: "components.faq.any_account_on_the_network_may_submit"
            },
            {
                q: "components.faq.can_the_foundation_just_submit_a_proposal",
                hint: "components.faq.it_can_submit_whether_it_passes_is",
                a: "components.faq.the_foundation_may_submit_a_proposal_as"
            },
            {
                q: "components.faq.what_stops_a_malicious_proposal_from_draining",
                hint: "components.faq.voting_by_people_who_hold_the_stake",
                a: "components.faq.a_malicious_proposal_can_be_submitted_it"
            },
        ],
    },
    {
        title: "components.faq.vi_words_and_why_they_matter",
        items: [
            {
                q: "components.faq.why_is_this_network_so_careful_about",
                hint: "components.faq.beliefs_shape_how_systems_get_treated_words",
                a: "components.faq.pxs_is_not_a_stablecoin_it_is"
            },
            {
                q: "components.faq.where_can_i_read_the_full_technical",
                hint: "components.faq.the_pxs_technical_specification_and_the_token",
                a: "components.faq.the_pxs_technical_specification_current_working_draf"
            },
        ],
    },
];

class FAQ extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            _expanded: false,
        };
    };

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return this.state._expanded !== nextState._expanded;
    }

    componentWillReceiveProps(nextProps, nextContext) {

        this.setState(nextProps, this.forceUpdate);
    }

    _handle_change = (panel) => (event, isExpanded) => {
        this.setState({_expanded: isExpanded ? panel : false}, this.forceUpdate);
    };

    _render_item = (section_index, item_index, item) => {
        const { classes } = this.state;
        const { _expanded } = this.state;
        const panel_id = "panel-" + section_index + "-" + item_index;

        return (
            <Accordion
                key={panel_id}
                className={classes.accordion}
                expanded={_expanded === panel_id}
                onChange={this._handle_change(panel_id)}
                square={true}
            >
                <AccordionSummary
                    className={classes.summary}
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls={panel_id + "-content"}
                    id={panel_id + "-header"}
                >
                    <Typography className={classes.heading}>{t(item.q)}</Typography>
                    {item.hint && (
                        <Typography className={classes.secondaryHeading}>{t(item.hint)}</Typography>
                    )}
                </AccordionSummary>
                <AccordionDetails className={classes.details}>
                    <Typography className={classes.detailsText}>{t(item.a)}</Typography>
                </AccordionDetails>
            </Accordion>
        );
    };

    _render_section = (section, section_index) => {
        const { classes } = this.state;

        return (
            <div key={"section-" + section_index}>
                <h2 className={classes.sectionTitle}>{t(section.title)}</h2>
                {section.items.map((item, i) => this._render_item(section_index, i, item))}
            </div>
        );
    };

    render() {

        const { classes } = this.state;

        return (
            <div className={classes.root}>
                {FAQ_SECTIONS.map((section, i) => this._render_section(section, i))}
            </div>
        );
    }
}

export default withStyles(styles)(FAQ);