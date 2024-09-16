import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import { t } from "../utils/text";
import { withLanguage } from "../utils/withLanguage";
const styles = theme => ({

});

class TermsOfUse extends React.PureComponent {

    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes
        };
    };

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        return false;
    }

    render() {

        const { classes } = this.state;

        return (
            <div>
                <h2>{t("components.terms_of_use.i_general_legal_protection_acceptance")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.users_must_explicitly_agree_to_the_terms")}</p></li>
                    <li><p>{t("components.terms_of_use.continued_use_of_the_platform_constitutes_accept")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_is_not_a_custodial_service")}</p></li>
                    <li><p>{t("components.terms_of_use.users_are_solely_responsible_for_ensuring_that")}</p></li>
                    <li><p>{t("components.terms_of_use.the_pixagram_ui_is_provided_as_is")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_does_not_offer_customer_support")}</p></li>
                    <li><p>{t("components.terms_of_use.no_guarantees_are_made_regarding_future_updates")}</p></li>
                    <li><p>{t("components.terms_of_use.users_agree_not_to_hold_pixagram_com")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_reserves_the_right_to_deny")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.ii_non_custodial_nature_user_responsibility")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.users_retain_full_control_over_their_private")}</p></li>
                    <li><p>{t("components.terms_of_use.all_transactions_are_final_and_irreversible_and")}</p></li>
                    <li><p>{t("components.terms_of_use.users_are_responsible_for_reviewing_smart_contra")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_does_not_process_store_or")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_sa_a_swiss_company_bears_no")}</p></li>
                    <li><p>{t("components.terms_of_use.users_assume_full_responsibility_for_securing_th")}</p></li>
                    <li><p>{t("components.terms_of_use.if_a_user_loses_their_private_key")}</p></li>
                    <li><p>{t("components.terms_of_use.users_agree_not_to_use_the_platform")}</p></li>
                    <li><p>{t("components.terms_of_use.any_loss_of_funds_due_to_user")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_disclaims_responsibility_for_smart_")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.iii_authority_intellectual_property_protections")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.the_pixagram_name_logo_and_branding_are")}</p></li>
                    <li><p>{t("components.terms_of_use.users_may_not_copy_modify_or_distribute")}</p></li>
                    <li><p>{t("components.terms_of_use.the_compiled_ui_is_a_verifiable_distribution")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_is_protected_under_swiss_intellectu")}</p></li>
                    <li><p>{t("components.terms_of_use.any_attempt_to_impersonate_pixagram_or_misrepres")}</p></li>
                    <li><p>{t("components.terms_of_use.the_platforms_source_code_remains_open_source")}</p></li>
                    <li><p>{t("components.terms_of_use.users_may_fork_the_software_but_may")}</p></li>
                    <li><p>{t("components.terms_of_use.unauthorized_use_of_pixagram_branding_in_fraudul")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.iv_freedom_of_speech_content_liability_waiver")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.pixagram_com_is_a_neutral_tool_that")}</p></li>
                    <li><p>{t("components.terms_of_use.all_responsibility_for_content_posted_rests_enti")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_does_not_promote_endorse_or")}</p></li>
                    <li><p>{t("components.terms_of_use.users_may_not_engage_in_illegal_activities")}</p></li>
                    <li><p>{t("components.terms_of_use.the_platforms_reputation_based_ranking_system_ma")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_cannot_be_sued_for_content_posted")}</p></li>
                    <li><p>{t("components.terms_of_use.censorship_via_governance_votes_is_prohibited_an")}</p></li>
                    <li><p>{t("components.terms_of_use.the_platform_does_not_allow_third_parties")}</p></li>
                    <li><p>{t("components.terms_of_use.any_attempt_to_enforce_external_moderation_polic")}</p></li>
                    <li><p>{t("components.terms_of_use.users_must_comply_with_laws_regarding_content")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.v_security_risks_and_no_liability_for")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.users_accept_all_risks_associated_with_smart")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_does_not_provide_refunds_reversals")}</p></li>
                    <li><p>{t("components.terms_of_use.hacks_security_vulnerabilities_and_exploits_are_")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_is_not_responsible_for_scams_phishing")}</p></li>
                    <li><p>{t("components.terms_of_use.users_must_review_and_verify_smart_contract")}</p></li>
                    <li><p>{t("components.terms_of_use.no_warranty_is_provided_for_third_party")}</p></li>
                    <li><p>{t("components.terms_of_use.users_agree_that_blockchain_transactions_are_imm")}</p></li>
                    <li><p>{t("components.terms_of_use.any_loss_due_to_an_incorrectly_executed")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_does_not_guarantee_protection_again")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_does_not_act_as_an_arbitrator")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.vi_right_to_be_forgotten_immutable_blockchain")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.blockchain_records_are_immutable_and_pixagram_co")}</p></li>
                    <li><p>{t("components.terms_of_use.users_must_understand_the_permanence_of_blockcha")}</p></li>
                    <li><p>{t("components.terms_of_use.users_requesting_content_removal_must_prove_owne")}</p></li>
                    <li><p>{t("components.terms_of_use.no_third_party_e_g_governments_companies")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_does_not_offer_deletion_services")}</p></li>
                    <li><p>{t("components.terms_of_use.the_right_to_be_forgotten_does_not")}</p></li>
                    <li><p>{t("components.terms_of_use.the_pixagram_foundation_is_not_responsible_for")}</p></li>
                    <li><p>{t("components.terms_of_use.users_take_full_responsibility_for_publishing_se")}</p></li>
                    <li><p>{t("components.terms_of_use.third_party_websites_archiving_blockchain_data_a")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.vii_nft_digital_asset_non_investment_status")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.pixagram_com_does_not_classify_nfts_as")}</p></li>
                    <li><p>{t("components.terms_of_use.the_platform_does_not_provide_tax_guidance")}</p></li>
                    <li><p>{t("components.terms_of_use.black_market_nft_sales_and_money_laundering")}</p></li>
                    <li><p>{t("components.terms_of_use.users_acknowledge_that_nft_ownership_does_not")}</p></li>
                    <li><p>{t("components.terms_of_use.no_investment_advice_is_provided_through_the")}</p></li>
                    <li><p>{t("components.terms_of_use.users_acknowledge_that_nft_prices_may_fluctuate")}</p></li>
                    <li><p>{t("components.terms_of_use.any_trading_of_nfts_is_done_at")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_does_not_facilitate_nft_sales")}</p></li>
                    <li><p>{t("components.terms_of_use.no_guarantees_are_made_about_the_liquidity")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.viii_jurisdiction_dispute_resolution")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.pixagram_com_operates_under_swiss_law_which")}</p></li>
                    <li><p>{t("components.terms_of_use.users_waive_the_right_to_class_action")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_com_is_not_responsible_for_regulatory")}</p></li>
                    <li><p>{t("components.terms_of_use.any_attempt_to_classify_pixagram_as_a")}</p></li>
                    <li><p>{t("components.terms_of_use.users_acknowledge_that_decentralized_governance_")}</p></li>
                    <li><p>{t("components.terms_of_use.users_may_not_claim_financial_damages_against")}</p></li>
                    <li><p>{t("components.terms_of_use.any_legal_claims_against_pixagram_sa_must")}</p></li>
                    <li><p>{t("components.terms_of_use.the_platform_is_protected_under_international_so")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.ix_governance_censorship_resistance")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.pixagram_com_cannot_be_forced_to_comply")}</p></li>
                    <li><p>{t("components.terms_of_use.any_governance_attempt_to_introduce_censorship_w")}</p></li>
                    <li><p>{t("components.terms_of_use.users_retain_the_right_to_fork_the")}</p></li>
                    <li><p>{t("components.terms_of_use.dao_governance_is_advisory_and_its_decisions")}</p></li>
                    <li><p>{t("components.terms_of_use.no_single_entity_may_seize_control_of")}</p></li>
                    <li><p>{t("components.terms_of_use.any_disputes_regarding_governance_must_be_settle")}</p></li>
                    <li><p>{t("components.terms_of_use.users_accept_that_dao_proposals_do_not")}</p></li>
                    <li><p>{t("components.terms_of_use.no_external_government_entity_may_impose_governa")}</p></li>
                    <li><p>{t("components.terms_of_use.the_pixagram_foundation_reserves_the_right_to")}</p></li>
                    <li><p>{t("components.terms_of_use.users_may_not_manipulate_governance_votes_throug")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.x_modification_of_terms_contact_information")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.pixagram_com_reserves_the_right_to_modify")}</p></li>
                    <li><p>{t("components.terms_of_use.users_are_responsible_for_staying_informed_of")}</p></li>
                    <li><p>{t("components.terms_of_use.pixagram_sa_has_no_obligation_to_inform")}</p></li>
                    <li><p>{t("components.terms_of_use.continued_use_of_the_platform_after_updates")}</p></li>
                    <li><p>{t("components.terms_of_use.any_modifications_will_be_legally_binding_upon")}</p></li>
                    <li><p>{t("components.terms_of_use.no_third_party_may_override_pixagrams_right")}</p></li>
                    <li><p>{t("components.terms_of_use.users_acknowledge_that_changes_may_occur_due")}</p></li>
                    <li><p>{t("components.terms_of_use.all_updates_are_made_to_ensure_compliance")}</p></li>
                    <li><p>{t("components.terms_of_use.users_may_not_challenge_modifications_in_a")}</p></li>
                    <li><p>{t("components.terms_of_use.by_using_pixagram_com_users_accept_all")}</p></li>
                </ul>
            </div>
        );
    }
}

export default withLanguage(withStyles(styles)(TermsOfUse));