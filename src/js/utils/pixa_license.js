import { t, tk, tx, isTk } from "./text";

/*
 * PIXA NFT LICENSE 1.0 — the license structure and its wording.
 *
 * The wording lives in the catalogue (components.pixa_license.*). LICENSE_TEXT
 * below holds tk() descriptors where the text goes; ids, defaults and
 * dependencies stay plain data — they are what a post stores on chain.
 *
 *   PIXA_LICENSE_BASE              the same tree with every text field turned
 *                                  into a getter that translates when it is
 *                                  read — so the License dialogs show the UI
 *                                  language without resolving anything
 *                                  themselves (read it at render, not at module
 *                                  scope).
 *   PIXA_LICENSE_BASE.localize(fn) a plain copy with every descriptor resolved
 *                                  by `fn` — licensePDF.js passes a translator
 *                                  in the PDF's language (utils/docLanguage.js).
 *
 * The customization tokens in the section contents ({royaltyPercentage},
 * {jurisdiction}, {court}, {arbitrationLocation}, {arbitrationRules}) are
 * single-brace and replaced by the renderers. The catalogue spells them
 * {{royaltyPercentage}} etc. — a normal variable for translators, which can
 * move it — and TOKEN fills each one back in as its single-brace form.
 * Product names (PIXA NFT LICENSE 1.0) stay literal.
 */

const TOKEN = {
    royaltyPercentage: "{royaltyPercentage}",
    jurisdiction: "{jurisdiction}",
    court: "{court}",
    arbitrationLocation: "{arbitrationLocation}",
    arbitrationRules: "{arbitrationRules}"
};
const UPPER = { TUC: true };

// Defined terms of the agreement, shown as "TERM: definition".
const KEY_TERMS = [
    [tk("components.pixa_license.author", undefined, UPPER), tk("components.pixa_license.the_individual_or_entity_who_created_and")],
    [tk("components.pixa_license.holder", undefined, UPPER), tk("components.pixa_license.the_person_or_entity_that_holds_a_valid_nft")],
    [tk("components.pixa_license.visitor", undefined, UPPER), tk("components.pixa_license.anyone_who_views_or_interacts_with_the")]
];

const LICENSE_TEXT = {
    "name": "PIXA NFT LICENSE 1.0",
    "version": "1.0",
    "shortName": "PIXA LICENSE 1.0",
    "description": tk("components.pixa_license.customizable_nft_license_agreement"),
    "explanation": {
        "purpose": tk("components.pixa_license.this_license_provides_a_flexible_transparent"),
        "mechanism": tk("components.pixa_license.this_license_delegates_and_allocates_copyright"),
        "keyTerms": { $terms: KEY_TERMS }
    },
    "sections": [
        {
            "id": "intro",
            "title": tk("components.pixa_license.legal_agreement", undefined, UPPER),
            "type": "intro",
            "content": tk("components.pixa_license.this_nft_license_agreement_the_agreement")
        },
        {
            "id": "ownership",
            "number": 1,
            "title": tk("components.pixa_license.ownership_and_moral_rights"),
            "type": "content",
            "content": tk("components.pixa_license.the_author_is_and_shall_remain_the_sole")
        },
        {
            "id": "license-options",
            "number": 2,
            "title": tk("components.pixa_license.license_options_for_the_holder"),
            "type": "customizable",
            "content": tk("components.pixa_license.the_holder_of_an_nft_is_granted_a_non"),
            "rightsCategories": [
                {
                    "id": "holder-rights",
                    "title": tk("components.pixa_license.rights_granted_to_the_holder"),
                    "rights": [
                        {
                            "id": "personal-display",
                            "label": tk("components.pixa_license.display_the_artwork_for_personal_non"),
                            "defaultValue": true,
                            "category": "basic",
                            "categoryLabel": tk("components.pixa_license.category_basic")
                        },
                        {
                            "id": "commercial-use",
                            "label": tk("components.pixa_license.use_the_artwork_for_commercial_purposes"),
                            "defaultValue": true,
                            "category": "commercial",
                            "categoryLabel": tk("components.pixa_license.category_commercial"),
                            "note": tk("components.pixa_license.if_granted_enables_commercial_sub_rights")
                        },
                        {
                            "id": "social-media",
                            "label": tk("components.pixa_license.use_in_social_media_or_advertising_campaigns"),
                            "defaultValue": true,
                            "category": "commercial",
                            "dependsOn": "commercial-use"
                        },
                        {
                            "id": "physical-goods",
                            "label": tk("components.pixa_license.print_on_physical_goods_t_shirts_posters"),
                            "defaultValue": true,
                            "category": "commercial",
                            "dependsOn": "commercial-use"
                        },
                        {
                            "id": "third-party-licensing",
                            "label": tk("components.pixa_license.license_to_third_parties_stock_sites_etc"),
                            "defaultValue": false,
                            "category": "commercial",
                            "dependsOn": "commercial-use"
                        },
                        {
                            "id": "modify",
                            "label": tk("components.pixa_license.modify_or_adapt_the_artwork"),
                            "defaultValue": true,
                            "category": "creative",
                            "categoryLabel": tk("components.pixa_license.category_creative"),
                            "note": tk("components.pixa_license.with_respect_to_the_authors_moral_rights")
                        },
                        {
                            "id": "derivatives",
                            "label": tk("components.pixa_license.create_public_derivative_works_or_remixes"),
                            "defaultValue": true,
                            "category": "creative",
                            "dependsOn": "modify"
                        },
                        {
                            "id": "mint-new-nfts",
                            "label": tk("components.pixa_license.mint_the_artwork_or_derivatives_into_new"),
                            "defaultValue": false,
                            "category": "creative",
                            "dependsOn": "modify"
                        },
                        {
                            "id": "metaverse",
                            "label": tk("components.pixa_license.use_in_virtual_environments_or_metaverses"),
                            "defaultValue": true,
                            "category": "digital",
                            "categoryLabel": tk("components.pixa_license.category_digital")
                        },
                        {
                            "id": "games-apps",
                            "label": tk("components.pixa_license.include_in_digital_games_or_apps"),
                            "defaultValue": true,
                            "category": "digital"
                        },
                        {
                            "id": "music-video-film",
                            "label": tk("components.pixa_license.use_in_music_videos_or_films"),
                            "defaultValue": true,
                            "category": "media",
                            "categoryLabel": tk("components.pixa_license.category_media")
                        },
                        {
                            "id": "exhibitions",
                            "label": tk("components.pixa_license.display_in_online_or_offline_exhibitions"),
                            "defaultValue": true,
                            "category": "display",
                            "categoryLabel": tk("components.pixa_license.category_display")
                        },
                        {
                            "id": "educational",
                            "label": tk("components.pixa_license.use_in_educational_materials_or"),
                            "defaultValue": true,
                            "category": "educational",
                            "categoryLabel": tk("components.pixa_license.category_educational")
                        }
                    ]
                },
                {
                    "id": "visitor-rights",
                    "title": tk("components.pixa_license.rights_granted_to_the_visitor"),
                    "rights": [
                        {
                            "id": "share-with-attribution",
                            "label": tk("components.pixa_license.share_the_artwork_with_mentioning_the"),
                            "defaultValue": true,
                            "category": "basic",
                            "categoryLabel": tk("components.pixa_license.category_basic")
                        },
                        {
                            "id": "share-without-attribution",
                            "label": tk("components.pixa_license.share_the_artwork_without_mentioning_the"),
                            "defaultValue": false,
                            "category": "basic"
                        },
                        {
                            "id": "modify-and-share",
                            "label": tk("components.pixa_license.modify_the_artwork_and_share_it_accordingly"),
                            "defaultValue": false,
                            "category": "creative",
                            "categoryLabel": tk("components.pixa_license.category_creative")
                        },
                        {
                            "id": "ai-training",
                            "label": tk("components.pixa_license.train_or_use_in_ai_or_machine_learning"),
                            "defaultValue": true,
                            "category": "advanced",
                            "categoryLabel": tk("components.pixa_license.category_advanced")
                        }
                    ]
                }
            ]
        },
        {
            "id": "royalty",
            "number": 3,
            "title": tk("components.pixa_license.royalty_on_secondary_sales"),
            "type": "customizable",
            "content": tk("components.pixa_license.the_author_shall_receive_a_royalty_of", { royaltyPercentage: TOKEN.royaltyPercentage }),
            "customFields": ["royaltyPercentage"]
        },
        {
            "id": "term",
            "number": 4,
            "title": tk("components.pixa_license.term_and_termination"),
            "type": "content",
            "content": tk("components.pixa_license.when_the_nft_is_sold_or_otherwise")
        },
        {
            "id": "governing-law",
            "number": 5,
            "title": tk("components.pixa_license.governing_law_and_jurisdiction"),
            "type": "customizable",
            "content": tk("components.pixa_license.this_agreement_shall_be_governed_by_and", {
                jurisdiction: TOKEN.jurisdiction,
                court: TOKEN.court,
                arbitrationLocation: TOKEN.arbitrationLocation,
                arbitrationRules: TOKEN.arbitrationRules
            }),
            "customFields": ["jurisdiction", "court", "arbitrationLocation", "arbitrationRules"]
        }
    ]
};

const isTerms = (v) => !!v && typeof v === "object" && Array.isArray(v.$terms);

// keyTerms is read as { TERM: definition }; the terms are translated too.
const termsObject = (terms, resolve) => {
    const out = {};
    for (const [term, definition] of terms) out[resolve(term)] = resolve(definition);
    return out;
};

/** Plain deep copy of the tree with every descriptor resolved by `resolve`. */
const resolveTree = (node, resolve) => {
    if (isTk(node)) return resolve(node);
    if (isTerms(node)) return termsObject(node.$terms, resolve);
    if (Array.isArray(node)) return node.map((n) => resolveTree(n, resolve));
    if (node && typeof node === "object") {
        const out = {};
        for (const k of Object.keys(node)) out[k] = resolveTree(node[k], resolve);
        return out;
    }
    return node;
};

/** The same tree, every text field a getter translating at read time (UI language). */
const liveTree = (node) => {
    if (Array.isArray(node)) return node.map(liveTree);
    if (!node || typeof node !== "object") return node;
    const out = {};
    for (const k of Object.keys(node)) {
        const v = node[k];
        if (isTk(v)) Object.defineProperty(out, k, { enumerable: true, configurable: true, get: () => tx(v) });
        else if (isTerms(v)) Object.defineProperty(out, k, { enumerable: true, configurable: true, get: () => termsObject(v.$terms, tx) });
        else out[k] = liveTree(v);
    }
    return out;
};

export const PIXA_LICENSE_BASE = liveTree(LICENSE_TEXT);

// Not enumerable: a spread / JSON copy of the base carries text, not this.
Object.defineProperty(PIXA_LICENSE_BASE, "localize", {
    value: (resolve) => resolveTree(LICENSE_TEXT, resolve)
});

export const PIXA_LICENSE_CUSTOMIZATION_EXAMPLE = {
    "isCustomized": true,
    "authorInfo": {},
    "artworkInfo": {},
    "rightsConfiguration": {
        "holderRights": {
            "personal-display": true,
            "commercial-use": true,
            "modify": false,
            "derivatives": true,
            "mint-new-nfts": false,
            "social-media": true,
            "metaverse": true,
            "physical-goods": true,
            "games-apps": true,
            "ai-training": true,
            "third-party-licensing": false,
            "music-video-film": true,
            "exhibitions": true,
            "educational": true
        },
        "visitorRights": {
            "share-with-attribution": true,
            "share-without-attribution": false,
            "modify-and-share": false,
            "ai-training": true
        }
    },
    "royaltyPercentage": 5,
    "governingLaw": {
        "jurisdiction": "Switzerland",
        "court": "Zug, Switzerland",
        "arbitrationLocation": "Zug, Switzerland",
        "arbitrationRules": "Swiss Arbitration Centre"
    },
    "metadata": {
        "licenseVersion": "1.0",
        "customizationVersion": "1.0",
        "generatedBy": "Pixagram License Generator"
    }
};

/**
 * License Data Utilities
 * Helper functions for loading, validating, and managing license data
 */

/**
 * Load base license structure
 * @returns {Object} Base license configuration
 */
export const loadBaseLicense = async () => {
    try {
        return Promise.resolve(PIXA_LICENSE_BASE);
    } catch (error) {
        console.error('Error loading base license:', error);
        return null;
    }
};

/**
 * Create default customization from base license
 * @param {Object} baseLicense - Base license structure
 * @returns {Object} Default customization with all rights set to default values
 */
export const createDefaultCustomization = (baseLicense) => {
    if (!baseLicense) return null;

    const customization = {
        isCustomized: false,
        rightsConfiguration: {
            holderRights: {},
            visitorRights: {}
        },
        royaltyPercentage: 5,
        governingLaw: {
            jurisdiction: '',
            court: '',
            arbitrationLocation: '',
            arbitrationRules: ''
        }
    };

    // Find the license options section
    const licenseOptionsSection = baseLicense.sections.find(s => s.id === 'license-options');
    if (licenseOptionsSection?.rightsCategories) {
        licenseOptionsSection.rightsCategories.forEach(category => {
            const configKey = category.id === 'holder-rights' ? 'holderRights' : 'visitorRights';
            category.rights.forEach(right => {
                customization.rightsConfiguration[configKey][right.id] = right.defaultValue;
            });
        });
    }

    return customization;
};

/**
 * Validate customization against base license
 * @param {Object} customization - Customization to validate
 * @param {Object} baseLicense - Base license structure
 * @returns {Object} Validation result with isValid flag and errors array
 *   (messages in the UI language; nothing compares them)
 */
export const validateCustomization = (customization, baseLicense) => {
    const errors = [];

    if (!customization || !baseLicense) {
        errors.push(t("components.pixa_license.missing_required_data"));
        return { isValid: false, errors };
    }

    // Validate royalty percentage
    if (customization.royaltyPercentage !== undefined) {
        if (typeof customization.royaltyPercentage !== 'number' ||
            customization.royaltyPercentage < 0 ||
            customization.royaltyPercentage > 100) {
            errors.push(t("components.pixa_license.royalty_percentage_must_be_between_0_and_100"));
        }
    }

    // Validate rights configuration exists
    if (!customization.rightsConfiguration) {
        errors.push(t("components.pixa_license.missing_rights_configuration"));
        return { isValid: false, errors };
    }

    // Validate holder rights
    const licenseOptionsSection = baseLicense.sections.find(s => s.id === 'license-options');
    if (licenseOptionsSection?.rightsCategories) {
        const holderRightsCategory = licenseOptionsSection.rightsCategories.find(c => c.id === 'holder-rights');
        if (holderRightsCategory) {
            holderRightsCategory.rights.forEach(right => {
                // Check dependent rights
                if (right.dependsOn &&
                    customization.rightsConfiguration.holderRights[right.id] === true &&
                    customization.rightsConfiguration.holderRights[right.dependsOn] !== true) {
                    const parent = holderRightsCategory.rights.find(r => r.id === right.dependsOn);
                    errors.push(t("components.pixa_license.right_requires_parent_to_be_granted", {
                        right: right.label,
                        parent: parent ? parent.label : right.dependsOn
                    }));
                }
            });
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Generate license text for blockchain/IPFS storage
 * @param {Object} baseLicense - Base license structure
 * @param {Object} customization - Applied customization
 * @returns {string} Complete license text — in the UI language, like every
 *   read of PIXA_LICENSE_BASE (nothing calls this today; a copy meant for
 *   storage should be built from PIXA_LICENSE_BASE.localize() in one fixed
 *   language instead)
 */
export const generateLicenseText = (baseLicense, customization) => {
    if (!baseLicense) return '';

    let text = `${baseLicense.name} v${baseLicense.version}\n\n`;

    if (customization?.authorInfo) {
        const { name, username, url } = customization.authorInfo;
        text += (username
            ? t("components.pixa_license.author_name_username", { name, username })
            : t("components.pixa_license.author_name", { name })) + '\n';
        if (url) text += t("components.pixa_license.url_line", { url }) + '\n';
        text += '\n';
    }

    const notSpecified = t("components.pixa_license.not_specified");
    baseLicense.sections.forEach(section => {
        if (section.type === 'intro') {
            text += `${section.title}\n${'='.repeat(section.title.length)}\n\n`;
            text += `${section.content}\n\n`;
        } else if (section.number) {
            text += `${section.number}. ${section.title}\n${'-'.repeat(section.title.length + 3)}\n\n`;

            if (section.type === 'customizable' && section.id === 'license-options') {
                text += `${section.content}\n\n`;

                section.rightsCategories?.forEach(category => {
                    text += `${category.title}:\n`;
                    const configKey = category.id === 'holder-rights' ? 'holderRights' : 'visitorRights';
                    const rightsConfig = customization?.rightsConfiguration?.[configKey] || {};

                    category.rights.forEach(right => {
                        const isGranted = rightsConfig[right.id] !== undefined
                            ? rightsConfig[right.id]
                            : right.defaultValue;

                        if (!right.dependsOn || rightsConfig[right.dependsOn] === true) {
                            text += `  ${isGranted ? '[✓]' : '[✗]'} ${right.label}\n`;
                        }
                    });
                    text += '\n';
                });
            } else {
                let content = section.content;

                // Apply customization replacements
                if (customization) {
                    if (customization.royaltyPercentage !== undefined) {
                        content = content.replace('{royaltyPercentage}', customization.royaltyPercentage);
                    }
                    if (customization.governingLaw) {
                        const { jurisdiction, court, arbitrationLocation, arbitrationRules } = customization.governingLaw;
                        content = content
                            .replace('{jurisdiction}', jurisdiction || notSpecified)
                            .replace('{court}', court || notSpecified)
                            .replace('{arbitrationLocation}', arbitrationLocation || notSpecified)
                            .replace('{arbitrationRules}', arbitrationRules || notSpecified);
                    }
                }

                // Remove markdown formatting for plain text
                content = content.replace(/\*\*/g, '');
                text += `${content}\n\n`;
            }
        }
    });

    return text;
};

/**
 * Generate compact license hash for on-chain storage
 * @param {Object} customization - License customization
 * @returns {string} Compact representation for blockchain
 */
export const generateLicenseHash = (customization) => {
    if (!customization) return '';

    const { rightsConfiguration, royaltyPercentage } = customization;

    // Create a compact binary representation
    const holderRights = rightsConfiguration?.holderRights || {};
    const visitorRights = rightsConfiguration?.visitorRights || {};

    // Convert to bit flags (this is a simplified version)
    const data = {
        V: 1, // version
        h: Object.keys(holderRights).filter(k => holderRights[k]),
        v: Object.keys(visitorRights).filter(k => visitorRights[k]),
        r: royaltyPercentage || 0
    };

    return JSON.stringify(data);
};

export default {
    PIXA_LICENSE_BASE,
    PIXA_LICENSE_CUSTOMIZATION_EXAMPLE,
    loadBaseLicense,
    createDefaultCustomization,
    validateCustomization,
    generateLicenseText,
    generateLicenseHash
};