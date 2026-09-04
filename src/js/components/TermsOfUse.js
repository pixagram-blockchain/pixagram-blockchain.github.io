import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import { t } from "../utils/text";
import { withLanguage } from "../utils/withLanguage";

// Pixagram Terms of Use — version 4, last updated 1 September 2026 (Pixa Rex
// S.A. as Operator). Every string lives in locales/en.js under
// components.terms_of_use, one key per paragraph / bullet, in document order.
// Rendered by AppInfoDialog (Terms tab) and by the agreement modal of
// CreateAccountDialog. Structure mirrors the source document: numbered
// sections as <h2>, prose as <p>, bullet lists as <ul>. Not translated —
// the English text is the binding version (Section 20, Entire agreement).
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
                <p>{t("components.terms_of_use.pixagram_interface_pixagram_com")}</p>
                <p><em>{t("components.terms_of_use.version_4_last_updated_1_september_2026")}</em></p>
                <p><em>{t("components.terms_of_use.in_short_courtesy_summary_not_binding_pixagram")}</em></p>
                <p>{t("components.terms_of_use.these_terms_of_use_the_terms_form")}</p>
                <p>{t("components.terms_of_use.in_these_terms")}</p>
                <ul>
                    <li><p><strong>{t("components.terms_of_use.protocol")}</strong> {t("components.terms_of_use.means_the_decentralized_open_source_blockchain_s")}</p></li>
                    <li><p><strong>{t("components.terms_of_use.content")}</strong> {t("components.terms_of_use.means_any_text_images_pixel_art_metadata")}</p></li>
                    <li><p><strong>{t("components.terms_of_use.permanent_storage")}</strong> {t("components.terms_of_use.means_third_party_permanent_storage_networks_to")}</p></li>
                    <li><p><strong>{t("components.terms_of_use.proxy")}</strong> {t("components.terms_of_use.means_the_operators_upload_relay_and_rendering")}</p></li>
                    <li><p><strong>{t("components.terms_of_use.account")}</strong> {t("components.terms_of_use.means_a_protocol_level_account_accounts_exist")}</p></li>
                    <li><p><strong>{t("components.terms_of_use.tokens")}</strong> {t("components.terms_of_use.means_digital_units_native_to_the_protocol")}</p></li>
                    <li><p><strong>{t("components.terms_of_use.register")}</strong> {t("components.terms_of_use.means_the_public_enforcement_register_described")}</p></li>
                    <li><p><strong>{t("components.terms_of_use.jurisdiction_list")}</strong> {t("components.terms_of_use.means_a_list_of_accounts_or_content")}</p></li>
                    <li><p><strong>{t("components.terms_of_use.default_list")}</strong> {t("components.terms_of_use.means_a_community_published_list_applied_by")}</p></li>
                    <li><p><strong>{t("components.terms_of_use.supervised_account")}</strong> {t("components.terms_of_use.means_an_account_used_by_a_person")}</p></li>
                </ul>
                <p>{t("components.terms_of_use.the_limited_personal_data_the_operator_processes")}</p>
                <p>{t("components.terms_of_use.please_read_these_terms_carefully_by_accessing")}</p>
                <h2>{t("components.terms_of_use.1_the_interface_the_protocol_and_how")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.the_interface_is_a_non_custodial_front")}</p></li>
                    <li><p>{t("components.terms_of_use.the_operator_is_not_a_broker_exchange")}</p></li>
                    <li><p>{t("components.terms_of_use.the_operator_is_never_a_party_counterparty")}</p></li>
                    <li><p>{t("components.terms_of_use.the_protocol_is_decentralized_open_source_softwa")}</p></li>
                    <li><p>{t("components.terms_of_use.the_interface_is_one_of_several_possible")}</p></li>
                    <li><p>{t("components.terms_of_use.the_interface_software_runs_in_your_browser")}</p></li>
                    <li><p>{t("components.terms_of_use.the_mirror_the_interface_is_designed_to")}</p></li>
                    <li><p>{t("components.terms_of_use.the_control_map_content_exists_at_three")}</p></li>
                    <li><p>{t("components.terms_of_use.no_guaranteed_visibility_we_do_not_guarantee")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.2_eligibility_age_and_supervision")}</h2>
                <p>{t("components.terms_of_use.by_accessing_or_using_the_interface_you")}</p>
                <ul>
                    <li><p>{t("components.terms_of_use.you_must_be_at_least_16_years")}</p></li>
                    <li><p>{t("components.terms_of_use.the_interface_is_not_intended_for_mature")}</p></li>
                    <li><p>{t("components.terms_of_use.the_operator_may_rely_on_age_information")}</p></li>
                    <li><p>{t("components.terms_of_use.if_you_are_under_18_certain_content")}</p></li>
                    <li><p>{t("components.terms_of_use.if_you_misrepresent_your_age_or_otherwise")}</p></li>
                </ul>
                <p>{t("components.terms_of_use.if_you_cease_to_satisfy_the_requirements")}</p>
                <h2>{t("components.terms_of_use.3_wallets_keys_self_custody_and_recovery")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.you_retain_full_and_exclusive_control_over")}</p></li>
                    <li><p>{t("components.terms_of_use.if_you_lose_access_to_your_wallet")}</p></li>
                    <li><p>{t("components.terms_of_use.recovery_is_a_protocol_feature_not_an")}</p></li>
                    <li><p>{t("components.terms_of_use.when_the_operator_acts_as_recovery_agent")}</p></li>
                    <li><p>{t("components.terms_of_use.the_operators_responsibility_in_connection_with")}</p></li>
                    <li><p>{t("components.terms_of_use.you_are_responsible_for_securing_the_devices")}</p></li>
                    <li><p>{t("components.terms_of_use.any_loss_arising_from_your_acts_or")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.4_blockchain_transactions")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.transactions_submitted_to_a_blockchain_are_by")}</p></li>
                    <li><p>{t("components.terms_of_use.you_are_responsible_for_reviewing_and_verifying")}</p></li>
                    <li><p>{t("components.terms_of_use.you_acknowledge_the_inherent_risks_of_blockchain")}</p></li>
                    <li><p>{t("components.terms_of_use.in_the_event_of_a_fork_or")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.5_tokens_and_rewards")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.the_interface_does_not_sell_offer_promote")}</p></li>
                    <li><p>{t("components.terms_of_use.any_tokens_you_may_receive_through_participation")}</p></li>
                    <li><p>{t("components.terms_of_use.such_tokens_are_intended_for_use_within")}</p></li>
                    <li><p>{t("components.terms_of_use.the_value_of_any_token_is_volatile")}</p></li>
                    <li><p>{t("components.terms_of_use.these_terms_govern_the_interface_only_any")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.6_user_content_the_community_and_the")}</h2>
                <p>{t("components.terms_of_use.you_are_solely_responsible_for_content_you")}</p>
                <p>{t("components.terms_of_use.your_rights_and_our_licence_you_retain")}</p>
                <p>{t("components.terms_of_use.publication_is_permanent_content_published_to_th")}</p>
                <p>{t("components.terms_of_use.you_must_not_use_the_interface_to")}</p>
                <ul>
                    <li><p>{t("components.terms_of_use.content_that_is_unlawful_under_any_law")}</p></li>
                    <li><p>{t("components.terms_of_use.child_sexual_abuse_material_or_any_content")}</p></li>
                    <li><p>{t("components.terms_of_use.terrorist_or_violent_extremist_content_or_conten")}</p></li>
                    <li><p>{t("components.terms_of_use.sexually_explicit_or_pornographic_content_or_gra")}</p></li>
                    <li><p>{t("components.terms_of_use.fraud_deceptive_schemes_market_manipulation_mone")}</p></li>
                    <li><p>{t("components.terms_of_use.infringement_of_intellectual_property_or_other_r")}</p></li>
                    <li><p>{t("components.terms_of_use.harassment_threats_doxxing_or_targeting_of_any")}</p></li>
                    <li><p>{t("components.terms_of_use.malware_or_attempts_to_gain_unauthorized_access")}</p></li>
                    <li><p>{t("components.terms_of_use.spam_manipulation_of_the_voting_mechanism_or")}</p></li>
                    <li><p>{t("components.terms_of_use.impersonation_of_any_person_or_misrepresentation")}</p></li>
                </ul>
                <p>{t("components.terms_of_use.visibility_belongs_to_the_community_by_default")}</p>
                <h2>{t("components.terms_of_use.7_the_reserved_core_and_the_public")}</h2>
                <p>{t("components.terms_of_use.interface_neutrality_the_interface_is_designed_t")}</p>
                <p>{t("components.terms_of_use.operator_measures_where_the_circumstances_descri")}</p>
                <p>{t("components.terms_of_use.public_enforcement_register_the_register_is_kept")}</p>
                <p>{t("components.terms_of_use.auditability_the_interface_applies_no_restrictio")}</p>
                <h2>{t("components.terms_of_use.8_jurisdiction_lists_default_lists_and_territory")}</h2>
                <p>{t("components.terms_of_use.jurisdiction_lists_any_court_or_public_authority")}</p>
                <p>{t("components.terms_of_use.default_lists_the_official_interface_may_apply")}</p>
                <p>{t("components.terms_of_use.territory_and_circumvention_the_interface_determ")}</p>
                <h2>{t("components.terms_of_use.9_third_party_services")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.the_interface_may_enable_interaction_with_protoc")}</p></li>
                    <li><p>{t("components.terms_of_use.software_may_contain_bugs_errors_or_vulnerabilit")}</p></li>
                    <li><p>{t("components.terms_of_use.any_reliance_on_third_party_services_including")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.10_no_investment_legal_or_tax_advice")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.nothing_made_available_through_the_interface_con")}</p></li>
                    <li><p>{t("components.terms_of_use.content_published_by_users_is_theirs_alone")}</p></li>
                    <li><p>{t("components.terms_of_use.you_are_solely_responsible_for_evaluating_the")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.11_intellectual_property_and_licence")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.the_names_logos_trademarks_and_other_branding")}</p></li>
                    <li><p>{t("components.terms_of_use.subject_to_these_terms_the_operator_grants")}</p></li>
                    <li><p>{t("components.terms_of_use.the_interfaces_source_code_including_the_proxy")}</p></li>
                    <li><p>{t("components.terms_of_use.your_content_remains_yours_subject_only_to")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.12_disclaimers")}</h2>
                <p>{t("components.terms_of_use.the_interface_is_provided_on_an_as")}</p>
                <p>{t("components.terms_of_use.without_limiting_the_foregoing_the_operator_does")}</p>
                <p>{t("components.terms_of_use.no_warranty_is_made_that_the_interface")}</p>
                <h2>{t("components.terms_of_use.13_limitation_of_liability")}</h2>
                <p>{t("components.terms_of_use.to_the_fullest_extent_permitted_by_applicable")}</p>
                <p>{t("components.terms_of_use.to_the_fullest_extent_permitted_by_applicable_2")}</p>
                <p>{t("components.terms_of_use.nothing_in_these_terms_excludes_or_limits")}</p>
                <h2>{t("components.terms_of_use.14_assumption_of_risk_and_release")}</h2>
                <p>{t("components.terms_of_use.you_access_and_use_the_interface_and")}</p>
                <p>{t("components.terms_of_use.to_the_fullest_extent_permitted_by_applicable_3")}</p>
                <h2>{t("components.terms_of_use.15_indemnification")}</h2>
                <p>{t("components.terms_of_use.to_the_fullest_extent_permitted_by_applicable_4")}</p>
                <p>{t("components.terms_of_use.if_you_use_the_interface_as_a")}</p>
                <h2>{t("components.terms_of_use.16_your_rights_as_a_consumer")}</h2>
                <p>{t("components.terms_of_use.if_you_use_the_interface_as_a_2")}</p>
                <p>{t("components.terms_of_use.nothing_in_the_governing_law_or_dispute")}</p>
                <p>{t("components.terms_of_use.in_case_of_any_conflict_between_this")}</p>
                <h2>{t("components.terms_of_use.17_changes_to_these_terms")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.we_may_update_these_terms_from_time")}</p></li>
                    <li><p>{t("components.terms_of_use.changes_take_effect_when_the_updated_terms")}</p></li>
                    <li><p>{t("components.terms_of_use.changes_do_not_apply_retroactively_and_for")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.18_suspension_termination_and_availability")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.we_may_modify_suspend_restrict_or_discontinue")}</p></li>
                    <li><p>{t("components.terms_of_use.because_the_protocol_is_decentralized_and_permis")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.19_governing_law_and_dispute_resolution")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.governing_law_these_terms_and_any_dispute")}</p></li>
                    <li><p>{t("components.terms_of_use.informal_resolution_before_commencing_any_formal")}</p></li>
                    <li><p>{t("components.terms_of_use.arbitration_any_dispute_not_resolved_informally")}</p></li>
                    <li><p>{t("components.terms_of_use.exceptions_notwithstanding_the_above_a_either_pa")}</p></li>
                    <li><p>{t("components.terms_of_use.individual_basis_to_the_fullest_extent_permitted")}</p></li>
                </ul>
                <h2>{t("components.terms_of_use.20_general")}</h2>
                <ul>
                    <li><p>{t("components.terms_of_use.survival_the_sections_addressing_tokens_and_rewa")}</p></li>
                    <li><p>{t("components.terms_of_use.severability_if_any_provision_of_these_terms")}</p></li>
                    <li><p>{t("components.terms_of_use.no_waiver_any_failure_to_enforce_a")}</p></li>
                    <li><p>{t("components.terms_of_use.assignment_we_may_assign_or_transfer_these")}</p></li>
                    <li><p>{t("components.terms_of_use.force_majeure_the_operator_is_not_liable")}</p></li>
                    <li><p>{t("components.terms_of_use.no_agency_nothing_in_these_terms_creates")}</p></li>
                    <li><p>{t("components.terms_of_use.feedback_if_you_provide_feedback_or_suggestions")}</p></li>
                    <li><p>{t("components.terms_of_use.third_party_beneficiaries_the_operators_affiliat")}</p></li>
                    <li><p>{t("components.terms_of_use.entire_agreement_these_terms_constitute_the_enti")}</p></li>
                </ul>
            </div>
        );
    }
}

export default withLanguage(withStyles(styles)(TermsOfUse));
