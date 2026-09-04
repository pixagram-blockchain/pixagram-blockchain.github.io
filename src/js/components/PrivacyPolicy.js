import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import { t } from "../utils/text";
import { withLanguage } from "../utils/withLanguage";

// Pixagram Privacy Policy — last updated 4 September 2026, companion to the
// Terms of Use. Every string lives in locales/en.js under
// components.privacy_policy, one key per paragraph / bullet (bold lead-ins
// get their own key), in document order. Rendered by AppInfoDialog (Privacy
// tab) and by the agreement modal of CreateAccountDialog. Not translated.
const styles = theme => ({

});

class PrivacyPolicy extends React.PureComponent {

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
                <p>{t("components.privacy_policy.pixagram_interface_pixagram_com_companion_to_the")}</p>
                <p>{t("components.privacy_policy.last_updated_4_september_2026")}</p>
                <p><strong>{t("components.privacy_policy.in_short")}</strong> <em>{t("components.privacy_policy.courtesy_summary_not_binding")}</em></p>
                <p><em>{t("components.privacy_policy.most_of_pixagram_is_public_by_design")}</em></p>
                <p>{t("components.privacy_policy.this_privacy_policy_uses_the_defined_terms")}</p>
                <h2>{t("components.privacy_policy.1_who_we_are_and_how_to")}</h2>
                <p>{t("components.privacy_policy.pixa_rex_s_a_a_sociedad_anonima")}</p>
                <h2>{t("components.privacy_policy.2_the_two_layers_of_pixagram")}</h2>
                <p>{t("components.privacy_policy.the_public_layer_accounts_posts_pixel_art")}</p>
                <p>{t("components.privacy_policy.the_off_chain_layer_the_small_set")}</p>
                <h2>{t("components.privacy_policy.3_what_we_process_off_chain_and")}</h2>
                <ul>
                    <li><p><strong>{t("components.privacy_policy.account_creation_phone_check")}</strong> {t("components.privacy_policy.to_keep_account_creation_human_and_roughly")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.age_assurance_only_where_applied")}</strong> {t("components.privacy_policy.we_do_not_generally_require_identity_or")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.territory_determination")}</strong> {t("components.privacy_policy.the_network_location_a_connection_presents_is")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.technical_and_security_data")}</strong> {t("components.privacy_policy.standard_connection_logs_and_security_signals_ne")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.upload_relay_proxy")}</strong> {t("components.privacy_policy.media_you_publish_passes_through_the_operators")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.account_recovery")}</strong> {t("components.privacy_policy.where_the_operators_account_service_is_set")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.legal_correspondence")}</strong> {t("components.privacy_policy.orders_and_formal_demands_we_receive_are")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.keys")}</strong> {t("components.privacy_policy.private_keys_are_generated_and_used_on")}</p></li>
                </ul>
                <h2>{t("components.privacy_policy.4_what_we_do_not_do")}</h2>
                <p>{t("components.privacy_policy.no_advertising_no_tracking_profiles_no_sale")}</p>
                <h2>{t("components.privacy_policy.5_minimum_age")}</h2>
                <p>{t("components.privacy_policy.the_interface_is_intended_for_users_aged")}</p>
                <h2>{t("components.privacy_policy.6_recipients_and_infrastructure")}</h2>
                <ul>
                    <li><p><strong>{t("components.privacy_policy.cloudflare_inc_united_states")}</strong> {t("components.privacy_policy.serving_proxying_and_protecting_the_interface_an")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.bird_formerly_messagebird_netherlands")}</strong> {t("components.privacy_policy.one_time_phone_verification_only_it_keeps")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.permanent_storage_bundling_services")}</strong> {t("components.privacy_policy.for_published_media_which_is_public_content")}</p></li>
                </ul>
                <p>{t("components.privacy_policy.off_chain_personal_data_is_shared_with")}</p>
                <h2>{t("components.privacy_policy.7_international_transfers")}</h2>
                <p>{t("components.privacy_policy.the_controller_is_in_panama_and_part")}</p>
                <h2>{t("components.privacy_policy.8_how_long_we_keep_data")}</h2>
                <p>{t("components.privacy_policy.we_keep_each_category_of_off_chain")}</p>
                <ul>
                    <li><p><strong>{t("components.privacy_policy.phone_number_hash")}</strong> {t("components.privacy_policy.for_as_long_as_your_account_exists")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.technical_and_security_logs")}</strong> {t("components.privacy_policy.no_longer_than_90_days")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.account_recovery_records")}</strong> {t("components.privacy_policy.for_the_life_of_the_account_and")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.legal_correspondence_2")}</strong> {t("components.privacy_policy.as_required_by_applicable_law_and_limitation")}</p></li>
                    <li><p><strong>{t("components.privacy_policy.age_assurance_data_where_used")}</strong> {t("components.privacy_policy.not_retained_beyond_the_check_itself_where")}</p></li>
                </ul>
                <h2>{t("components.privacy_policy.9_your_rights")}</h2>
                <p>{t("components.privacy_policy.for_off_chain_data_you_have_the")}</p>
                <p>{t("components.privacy_policy.because_the_phone_number_hash_exists_specificall")}</p>
                <p>{t("components.privacy_policy.for_the_public_layer_erasure_and_rectification")}</p>
                <h2>{t("components.privacy_policy.10_changes_to_this_policy")}</h2>
                <p>{t("components.privacy_policy.we_follow_the_same_regime_as_the")}</p>
            </div>
        );
    }
}

export default withLanguage(withStyles(styles)(PrivacyPolicy));
