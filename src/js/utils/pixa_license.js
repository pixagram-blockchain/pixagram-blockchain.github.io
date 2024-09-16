export const PIXA_LICENSE_BASE = {
    "name": "PIXA NFT LICENSE 1.0",
    "version": "1.0",
    "shortName": "PIXA LICENSE 1.0",
    "description": "Customizable NFT License Agreement",
    "explanation": {
        "purpose": "This license provides a flexible, transparent, and fair licensing framework that can adapt to different use cases, business models, and artistic intentions, while ensuring that the moral rights of the Author remain intact and fully preserved.",
        "mechanism": "This license delegates and allocates copyright permissions, which are by default very strict, from the Author onto the NFT Owner(s) and Visitor(s). The Author retains full intellectual property ownership while granting specific usage rights based on their preferences.",
        "keyTerms": {
            "AUTHOR": "The individual or entity who created and owns the copyright to the artwork.",
            "HOLDER": "The person or entity that holds a valid NFT representing or associated with the artwork.",
            "VISITOR": "Anyone who views or interacts with the artwork but does not own the associated NFT."
        }
    },
    "sections": [
        {
            "id": "intro",
            "title": "LEGAL AGREEMENT",
            "type": "intro",
            "content": "This NFT License Agreement (the \"Agreement\") sets forth the customizable terms under which the creator (hereinafter referred to as the \"Author\") grants certain rights to the purchaser (the \"Holder\") of non-fungible tokens (NFTs) associated with a specific collection of digital artwork (the \"Collection\"). The aim of this Agreement is to offer a flexible, transparent, and fair licensing framework that can adapt to different use cases, business models, and artistic intentions, while ensuring that the moral rights of the Author remain intact and fully preserved. This structure is particularly designed for NFT creators who wish to provide tailored usage rights to holders of their digital assets, enabling a range of interactions and exploitations with the artwork depending on the Author's selected preferences."
        },
        {
            "id": "ownership",
            "number": 1,
            "title": "Ownership and Moral Rights",
            "type": "content",
            "content": "The Author is and shall remain the sole and exclusive owner of all intellectual property rights in the underlying artworks and any associated content linked to the NFTs. The Author retains all moral rights, including the right to be identified as the creator and to object to any distortion, mutilation, or other modification of the work that would prejudice their honor or reputation. These moral rights are non-transferable and perpetual, and shall be respected by all Holders and third parties. This Agreement shall not be interpreted as a waiver or limitation of such rights."
        },
        {
            "id": "license-options",
            "number": 2,
            "title": "License Options for the Holder",
            "type": "customizable",
            "content": "The Holder of an NFT is granted a non-exclusive, worldwide, royalty-free license to use the digital artwork associated with the NFT, but only to the extent expressly permitted by the Author below. The license is linked strictly to the specific NFT owned and is automatically transferred upon resale. The purpose of this section is to allow the Author to select the scope of rights granted to each Holder, thus offering legal clarity and creative flexibility for both parties. For each listed right, the Author may indicate whether the Holder is permitted to exercise it.",
            "rightsCategories": [
                {
                    "id": "holder-rights",
                    "title": "Rights Granted to the Holder",
                    "rights": [
                        {
                            "id": "personal-display",
                            "label": "Display the artwork for personal, non-commercial use",
                            "defaultValue": true,
                            "category": "basic",
                            "categoryLabel": "Basic"
                        },
                        {
                            "id": "commercial-use",
                            "label": "Use the artwork for commercial purposes",
                            "defaultValue": true,
                            "category": "commercial",
                            "categoryLabel": "Commercial",
                            "note": "If granted, enables commercial sub-rights below"
                        },
                        {
                            "id": "social-media",
                            "label": "Use in social media or advertising campaigns",
                            "defaultValue": true,
                            "category": "commercial",
                            "dependsOn": "commercial-use"
                        },
                        {
                            "id": "physical-goods",
                            "label": "Print on physical goods (T-shirts, posters, etc.)",
                            "defaultValue": true,
                            "category": "commercial",
                            "dependsOn": "commercial-use"
                        },
                        {
                            "id": "third-party-licensing",
                            "label": "License to third parties (stock sites, etc.)",
                            "defaultValue": false,
                            "category": "commercial",
                            "dependsOn": "commercial-use"
                        },
                        {
                            "id": "modify",
                            "label": "Modify or adapt the artwork",
                            "defaultValue": true,
                            "category": "creative",
                            "categoryLabel": "Creative",
                            "note": "With respect to the Author's moral rights"
                        },
                        {
                            "id": "derivatives",
                            "label": "Create public derivative works or remixes",
                            "defaultValue": true,
                            "category": "creative",
                            "dependsOn": "modify"
                        },
                        {
                            "id": "mint-new-nfts",
                            "label": "Mint the artwork or derivatives into new NFTs",
                            "defaultValue": false,
                            "category": "creative",
                            "dependsOn": "modify"
                        },
                        {
                            "id": "metaverse",
                            "label": "Use in virtual environments or metaverses",
                            "defaultValue": true,
                            "category": "digital",
                            "categoryLabel": "Digital"
                        },
                        {
                            "id": "games-apps",
                            "label": "Include in digital games or apps",
                            "defaultValue": true,
                            "category": "digital"
                        },
                        {
                            "id": "music-video-film",
                            "label": "Use in music videos or films",
                            "defaultValue": true,
                            "category": "media",
                            "categoryLabel": "Media"
                        },
                        {
                            "id": "exhibitions",
                            "label": "Display in online or offline exhibitions",
                            "defaultValue": true,
                            "category": "display",
                            "categoryLabel": "Display"
                        },
                        {
                            "id": "educational",
                            "label": "Use in educational materials or presentations",
                            "defaultValue": true,
                            "category": "educational",
                            "categoryLabel": "Educational"
                        }
                    ]
                },
                {
                    "id": "visitor-rights",
                    "title": "Rights Granted to the Visitor",
                    "rights": [
                        {
                            "id": "share-with-attribution",
                            "label": "Share the artwork with mentioning the author",
                            "defaultValue": true,
                            "category": "basic",
                            "categoryLabel": "Basic"
                        },
                        {
                            "id": "share-without-attribution",
                            "label": "Share the artwork without mentioning the author",
                            "defaultValue": false,
                            "category": "basic"
                        },
                        {
                            "id": "modify-and-share",
                            "label": "Modify the artwork (and share it accordingly to this license)",
                            "defaultValue": false,
                            "category": "creative",
                            "categoryLabel": "Creative"
                        },
                        {
                            "id": "ai-training",
                            "label": "Train or use in AI or machine learning models",
                            "defaultValue": true,
                            "category": "advanced",
                            "categoryLabel": "Advanced"
                        }
                    ]
                }
            ]
        },
        {
            "id": "royalty",
            "number": 3,
            "title": "Royalty on Secondary Sales",
            "type": "customizable",
            "content": "The Author shall receive a royalty of **{royaltyPercentage}%** on all secondary sales or transfers of the NFTs, regardless of the marketplace or means of transaction. This royalty shall be enforced automatically through smart contract functionality where supported. In the event the transaction occurs outside of an automated system, the seller is responsible for ensuring the Author receives the due royalty and for the compliance to the aforementioned rights.",
            "customFields": ["royaltyPercentage"]
        },
        {
            "id": "term",
            "number": 4,
            "title": "Term and Termination",
            "type": "content",
            "content": "When the NFT is sold or otherwise transferred, the rights that this license grants to the Holder are simultaneously transferred to the new owner, and all rights of the previous Holder are terminated without further notice. Any use of the artwork beyond the term of ownership shall be considered unauthorized."
        },
        {
            "id": "governing-law",
            "number": 5,
            "title": "Governing Law and Jurisdiction",
            "type": "customizable",
            "content": "This Agreement shall be governed by and construed in accordance with the laws of **{jurisdiction}**. Any disputes arising in connection with this Agreement shall be subject to the exclusive jurisdiction of the courts of **{court}**, or alternatively resolved by arbitration/mediation seated in **{arbitrationLocation}**, in accordance with the rules of **{arbitrationRules}**.",
            "customFields": ["jurisdiction", "court", "arbitrationLocation", "arbitrationRules"]
        }
    ]
};

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
 */
export const validateCustomization = (customization, baseLicense) => {
    const errors = [];

    if (!customization || !baseLicense) {
        errors.push('Missing required data');
        return { isValid: false, errors };
    }

    // Validate royalty percentage
    if (customization.royaltyPercentage !== undefined) {
        if (typeof customization.royaltyPercentage !== 'number' ||
            customization.royaltyPercentage < 0 ||
            customization.royaltyPercentage > 100) {
            errors.push('Royalty percentage must be between 0 and 100');
        }
    }

    // Validate rights configuration exists
    if (!customization.rightsConfiguration) {
        errors.push('Missing rights configuration');
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
                    errors.push(`${right.label} requires ${right.dependsOn} to be granted`);
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
 * @returns {string} Complete license text
 */
export const generateLicenseText = (baseLicense, customization) => {
    if (!baseLicense) return '';

    let text = `${baseLicense.name} v${baseLicense.version}\n\n`;

    if (customization?.authorInfo) {
        const { name, username, url } = customization.authorInfo;
        text += `Author: ${name}${username ? ` (@${username})` : ''}\n`;
        if (url) text += `URL: ${url}\n`;
        text += '\n';
    }

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
                            .replace('{jurisdiction}', jurisdiction || '[Not Specified]')
                            .replace('{court}', court || '[Not Specified]')
                            .replace('{arbitrationLocation}', arbitrationLocation || '[Not Specified]')
                            .replace('{arbitrationRules}', arbitrationRules || '[Not Specified]');
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