// ── Default NFT license (Settings → NewPost) ─────────────────────────────────
// The Settings dialog stores the author's default license terms as ONE
// `default_license` object in the settings document — the customization shape
// LicenseCustomizationDialog emits — or null, meaning "the standard terms".
// NewPost starts every draft from it.
//
// A stored default is never used as-is: it is RESOLVED against the current
// PIXA_LICENSE_BASE first, so a right added since the default was saved gets
// its base default, a right that no longer exists drops out, a dependent right
// never stays granted without its parent, and an out-of-range royalty or a
// non-string governing-law field falls back to the standard value. That keeps
// the publish payload complete and deterministic whatever vintage the stored
// document is.
//
// utils/settings.js stays license-agnostic (it stores an object or null);
// this module is the one place the license shape is known outside the editor.

import { createDefaultCustomization } from "./pixa_license";

const GOVERNING_LAW_FIELDS = ["jurisdiction", "court", "arbitrationLocation", "arbitrationRules"];

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

// Same mapping the editor uses: the "holder-rights" category writes to
// rightsConfiguration.holderRights, every other category to visitorRights.
const configKeyFor = (category) => (category.id === "holder-rights" ? "holderRights" : "visitorRights");

const rightsCategoriesOf = (base) => {
    const sections = base && Array.isArray(base.sections) ? base.sections : [];
    const options = sections.find((section) => section && section.id === "license-options");
    return options && Array.isArray(options.rightsCategories) ? options.rightsCategories : [];
};

const rightsOf = (category) => (Array.isArray(category.rights) ? category.rights : []);

/** True when `value` is a stored default license; anything else means "standard terms". */
export const hasDefaultLicense = (value) => isPlainObject(value);

/**
 * The complete customization a new post starts from: the base default
 * (createDefaultCustomization) with the stored default layered over it field
 * by field and validated against `base`. Always returns a complete object —
 * with no stored default it IS the base default, unchanged.
 */
export const resolveDefaultLicense = (stored, base) => {
    const fallback = createDefaultCustomization(base) || {};
    if (!hasDefaultLicense(stored)) return fallback;

    const storedRights = isPlainObject(stored.rightsConfiguration) ? stored.rightsConfiguration : {};
    const fallbackRights = isPlainObject(fallback.rightsConfiguration) ? fallback.rightsConfiguration : {};
    const rightsConfiguration = { holderRights: {}, visitorRights: {} };

    for (const category of rightsCategoriesOf(base)) {
        const key = configKeyFor(category);
        const rights = rightsOf(category);
        const chosen = isPlainObject(storedRights[key]) ? storedRights[key] : {};
        const standard = isPlainObject(fallbackRights[key]) ? fallbackRights[key] : {};
        const out = rightsConfiguration[key];

        // Only rights the CURRENT base knows; stored → base default → right default.
        for (const right of rights) {
            if (typeof chosen[right.id] === "boolean") out[right.id] = chosen[right.id];
            else if (typeof standard[right.id] === "boolean") out[right.id] = standard[right.id];
            else out[right.id] = !!right.defaultValue;
        }
        // A dependent right cannot outlive its parent. The editor enforces this
        // when saving; the base may have changed since the default was saved.
        for (const right of rights) {
            if (right.dependsOn && !out[right.dependsOn]) out[right.id] = false;
        }
    }

    const royalty = stored.royaltyPercentage;
    const royaltyPercentage = (typeof royalty === "number" && Number.isFinite(royalty) && royalty >= 0 && royalty <= 100)
        ? royalty
        : (typeof fallback.royaltyPercentage === "number" ? fallback.royaltyPercentage : 0);

    const governingLaw = { ...(isPlainObject(fallback.governingLaw) ? fallback.governingLaw : {}) };
    const storedLaw = isPlainObject(stored.governingLaw) ? stored.governingLaw : {};
    for (const field of GOVERNING_LAW_FIELDS) {
        if (typeof storedLaw[field] === "string") governingLaw[field] = storedLaw[field];
    }

    const resolved = { ...fallback, rightsConfiguration, royaltyPercentage, governingLaw };
    if (typeof stored.version === "string") resolved.version = stored.version;
    if (typeof stored.isCustomized === "boolean") resolved.isCustomized = stored.isCustomized;
    return resolved;
};

/**
 * Figures for a one-line summary of a (resolved) customization: rights granted
 * out of rights known per side — a dependent right counts only while its
 * parent is granted, as the editor counts them — plus royalty and jurisdiction.
 */
export const summarizeLicense = (customization, base) => {
    const summary = {
        holderGranted: 0, holderTotal: 0,
        visitorGranted: 0, visitorTotal: 0,
        royaltyPercentage: 0,
        jurisdiction: ""
    };
    const rights = customization && isPlainObject(customization.rightsConfiguration)
        ? customization.rightsConfiguration
        : {};

    for (const category of rightsCategoriesOf(base)) {
        const side = configKeyFor(category) === "holderRights" ? "holder" : "visitor";
        const granted = isPlainObject(rights[configKeyFor(category)]) ? rights[configKeyFor(category)] : {};
        for (const right of rightsOf(category)) {
            summary[side + "Total"] += 1;
            if (granted[right.id] && (!right.dependsOn || granted[right.dependsOn])) summary[side + "Granted"] += 1;
        }
    }

    const royalty = customization ? customization.royaltyPercentage : 0;
    summary.royaltyPercentage = (typeof royalty === "number" && Number.isFinite(royalty)) ? royalty : 0;
    const law = customization && isPlainObject(customization.governingLaw) ? customization.governingLaw : {};
    summary.jurisdiction = typeof law.jurisdiction === "string" ? law.jurisdiction : "";
    return summary;
};
