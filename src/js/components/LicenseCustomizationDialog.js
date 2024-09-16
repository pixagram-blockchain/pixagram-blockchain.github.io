import * as React from "preact/compat";
import { useState, useEffect, useMemo } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from '@material-ui/core/Switch';
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Accordion from "@material-ui/core/Accordion";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import SubdirectoryArrowRight from "@material-ui/icons/SubdirectoryArrowRight";
import InfoOutlined from "@material-ui/icons/InfoOutlined";
import Tooltip from "@material-ui/core/Tooltip";
import Divider from "@material-ui/core/Divider";

import { t } from "../utils/text";

const styles = theme => ({
    dialog: {
        backgroundColor: "#101010 !important",
        [theme.breakpoints.down("xs")]: {
            "&.MuiDialog-paper": {
                margin: "0px 0px",
                maxHeight: "100%",
                borderRadius: 0,
                width: "100%"
            },
            "&.MuiDialog-paperFullWidth": {
                width: "min(calc(100% - 64px), 640px)"
            }
        },
        "& .MuiDialogContent-root": {
            padding: "8px 32px"
        }
    },
    dialogBody: {
        overflowY: "auto",
        display: "flex",
        flexDirection: "column"
    },
    section: {
        marginBottom: theme.spacing(3)
    },
    sectionTitle: {
        fontSize: "1.25rem",
        fontWeight: 600,
        marginBottom: theme.spacing(2),
        fontFamily: `'Industry Book'`,
        color: "#fff"
    },
    accordion: {
        "& .MuiAccordionDetails-root": { overflow: "hidden" },
        "& .MuiAccordion-root:before, & div.MuiAccordion-root.Mui-expanded:before": { opacity: 0 },
        "& .MuiAccordion-root": { margin: "8px 0" },
        "& .MuiAccordion-rounded:first-child": { borderTopLeftRadius: "21px", borderTopRightRadius: "21px" },
        "& .MuiAccordion-rounded:last-child": { borderBottomLeftRadius: "21px", borderBottomRightRadius: "21px" },
        backgroundColor: "#191919 !important",
        borderRadius: "16px !important",
        marginBottom: theme.spacing(1),
        "&:before": {
            display: "none"
        },
        "&.Mui-expanded": {
            margin: `${theme.spacing(1)}px 0 !important`
        }
    },
    accordionSummary: {
        backgroundColor: "#191919",
        borderRadius: "16px",
        minHeight: "56px !important",
        "&.Mui-expanded": {
            minHeight: "56px !important",
            borderRadius: "16px 16px 0 0"
        },
        "& .MuiAccordionSummary-content": {
            margin: "12px 0 !important"
        }
    },
    accordionDetails: {
        padding: theme.spacing(2),
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(1)
    },
    categoryLabel: {
        fontFamily: `'Industry Book'`,
        fontWeight: 600,
        fontSize: "1rem",
        color: "#fff"
    },
    rightItem: {
        display: "flex",
        alignItems: "flex-start",
        padding: "8px 12px",
        borderRadius: "12px",
        transition: "background-color 0.2s",
        "&:hover": {
            backgroundColor: "#ffffff08"
        }
    },
    nestedRightItem: {
        paddingLeft: "32px",
        position: "relative"
    },
    nestedIcon: {
        fontSize: "1rem",
        marginRight: "8px",
        color: "#666",
        position: "absolute",
        left: "12px",
        top: "16px"
    },
    rightLabel: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(0.5)
    },
    rightLabelText: {
        fontSize: "0.95rem",
        color: "#ddd",
        fontFamily: `'Normative Pro'`,
        marginTop: 12,
    },
    rightNote: {
        fontSize: "0.75rem",
        color: "#aaa",
        fontStyle: "italic"
    },
    textFieldsContainer: {
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(2),
        marginTop: theme.spacing(1)
    },
    textField: {
        "& .MuiInputBase-root": {
            backgroundColor: "#191919",
            borderRadius: "12px",
            color: "#ddd"
        },
        "& .MuiInputLabel-root": {
            color: "#999"
        },
        "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#333"
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#555"
        },
        "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#666"
        }
    },
    infoBox: {
        backgroundColor: "#191919",
        padding: theme.spacing(2),
        borderRadius: "16px",
        marginBottom: theme.spacing(3),
        display: "flex",
        gap: theme.spacing(1.5),
        alignItems: "flex-start"
    },
    infoIcon: {
        color: "#bbb",
        fontSize: "1.25rem",
        marginTop: "2px"
    },
    infoText: {
        fontSize: "0.875rem",
        color: "#bbb",
        lineHeight: 1.6
    },
    divider: {
        backgroundColor: "#ffffff12",
        margin: `${theme.spacing(3)}px 0`
    },
    summaryCount: {
        marginLeft: "auto",
        fontSize: "0.875rem",
        color: "#999",
        fontWeight: 400
    }
});

const LicenseCustomizationDialog = ({ classes, open, onClose, onSave, licenseBase, initialCustomization }) => {
    const [customization, setCustomization] = useState(null);
    const [errors, setErrors] = useState({});

    // Initialize customization state
    useEffect(() => {
        if (open && licenseBase) {
            if (initialCustomization) {
                setCustomization(initialCustomization);
            } else {
                // Create default customization
                const defaultCustomization = {
                    isCustomized: true,
                    rightsConfiguration: {
                        holderRights: {},
                        visitorRights: {}
                    },
                    royaltyPercentage: 10,
                    governingLaw: {
                        jurisdiction: "Switzerland",
                        court: "Zug, Switzerland",
                        arbitrationLocation: "Zug, Switzerland",
                        arbitrationRules: "Swiss Arbitration Centre"
                    }
                };

                // Set default values from license base
                const licenseOptionsSection = licenseBase.sections.find(s => s.id === 'license-options');
                if (licenseOptionsSection?.rightsCategories) {
                    licenseOptionsSection.rightsCategories.forEach(category => {
                        const configKey = category.id === 'holder-rights' ? 'holderRights' : 'visitorRights';
                        category.rights.forEach(right => {
                            defaultCustomization.rightsConfiguration[configKey][right.id] = right.defaultValue;
                        });
                    });
                }

                setCustomization(defaultCustomization);
            }
        }
    }, [open, licenseBase, initialCustomization]);

    // Handle right toggle
    const handleRightToggle = (categoryId, rightId, dependsOn = null) => {
        setCustomization(prev => {
            const configKey = categoryId === 'holder-rights' ? 'holderRights' : 'visitorRights';
            const newRights = { ...prev.rightsConfiguration[configKey] };

            const newValue = !newRights[rightId];
            newRights[rightId] = newValue;

            // If disabling a parent right, also disable dependent rights
            if (!newValue && !dependsOn) {
                const licenseOptionsSection = licenseBase.sections.find(s => s.id === 'license-options');
                const category = licenseOptionsSection?.rightsCategories?.find(c => c.id === categoryId);

                if (category) {
                    category.rights.forEach(right => {
                        if (right.dependsOn === rightId) {
                            newRights[right.id] = false;
                        }
                    });
                }
            }

            return {
                ...prev,
                rightsConfiguration: {
                    ...prev.rightsConfiguration,
                    [configKey]: newRights
                }
            };
        });
    };

    // Handle royalty percentage change
    const handleRoyaltyChange = (event) => {
        const value = event.target.value;
        const numValue = parseFloat(value);

        if (value === '' || (numValue >= 0 && numValue <= 100)) {
            setCustomization(prev => ({
                ...prev,
                royaltyPercentage: value === '' ? '' : numValue
            }));
            setErrors(prev => ({ ...prev, royalty: null }));
        } else {
            setErrors(prev => ({ ...prev, royalty: 'Must be between 0 and 100' }));
        }
    };

    // Handle governing law changes
    const handleGoverningLawChange = (field, value) => {
        setCustomization(prev => ({
            ...prev,
            governingLaw: {
                ...prev.governingLaw,
                [field]: value
            }
        }));
    };

    // Validate and save
    const handleSave = () => {
        // Validate royalty
        if (customization.royaltyPercentage === '' ||
            customization.royaltyPercentage < 0 ||
            customization.royaltyPercentage > 100) {
            setErrors(prev => ({ ...prev, royalty: 'Royalty percentage is required and must be between 0 and 100' }));
            return;
        }

        // Validate dependent rights
        const licenseOptionsSection = licenseBase.sections.find(s => s.id === 'license-options');
        const holderRightsCategory = licenseOptionsSection?.rightsCategories?.find(c => c.id === 'holder-rights');

        if (holderRightsCategory) {
            const holderRights = customization.rightsConfiguration.holderRights;
            const dependencyErrors = [];

            holderRightsCategory.rights.forEach(right => {
                if (right.dependsOn && holderRights[right.id] && !holderRights[right.dependsOn]) {
                    dependencyErrors.push(`"${right.label}" requires "${right.dependsOn}" to be enabled`);
                }
            });

            if (dependencyErrors.length > 0) {
                setErrors(prev => ({ ...prev, dependencies: dependencyErrors.join(', ') }));
                return;
            }
        }

        onSave(customization);
    };

    // Group rights by category
    const groupRightsByCategory = (rights) => {
        const categories = {};
        const categoryOrder = ['basic', 'commercial', 'creative', 'digital', 'media', 'display', 'educational', 'advanced'];

        rights.forEach(right => {
            if (!categories[right.category]) {
                categories[right.category] = {
                    label: right.categoryLabel || right.category.charAt(0).toUpperCase() + right.category.slice(1),
                    rights: []
                };
            }
            categories[right.category].rights.push(right);
        });

        return categoryOrder
            .filter(cat => categories[cat])
            .map(cat => ({ category: cat, ...categories[cat] }));
    };

    // Count enabled rights in a category
    const countEnabledRights = (categoryId, groupedRights) => {
        const configKey = categoryId === 'holder-rights' ? 'holderRights' : 'visitorRights';
        const rightsConfig = customization?.rightsConfiguration?.[configKey] || {};

        let count = 0;
        groupedRights.forEach(({ rights }) => {
            rights.forEach(right => {
                if (rightsConfig[right.id]) {
                    // Only count if parent is also enabled (for dependent rights)
                    if (!right.dependsOn || rightsConfig[right.dependsOn]) {
                        count++;
                    }
                }
            });
        });
        return count;
    };

    // Render rights category section
    const renderRightsCategory = (rightsCategory) => {
        const categoryId = rightsCategory.id;
        const configKey = categoryId === 'holder-rights' ? 'holderRights' : 'visitorRights';
        const rightsConfig = customization?.rightsConfiguration?.[configKey] || {};
        const groupedRights = groupRightsByCategory(rightsCategory.rights);
        const enabledCount = countEnabledRights(categoryId, groupedRights);

        return (
            <div className={classes.section} key={categoryId}>
                <Typography className={classes.sectionTitle}>
                    {rightsCategory.title}
                </Typography>

                {groupedRights.map(({ category, label, rights }) => (
                    <Accordion key={category} className={classes.accordion} defaultExpanded={category === 'basic'}>
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon style={{ color: "#999" }} />}
                            className={classes.accordionSummary}
                        >
                            <Typography className={classes.categoryLabel}>{label}</Typography>
                            <Typography className={classes.summaryCount}>
                                {rights.filter(r => rightsConfig[r.id] && (!r.dependsOn || rightsConfig[r.dependsOn])).length}/{rights.length}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails className={classes.accordionDetails}>
                            {rights.map(right => {
                                const isGranted = rightsConfig[right.id] || false;
                                const isDependent = Boolean(right.dependsOn);
                                const parentGranted = !right.dependsOn || rightsConfig[right.dependsOn];

                                return (
                                    <div
                                        key={right.id}
                                        className={`${classes.rightItem} ${isDependent ? classes.nestedRightItem : ''}`}
                                    >
                                        {isDependent && (
                                            <SubdirectoryArrowRight className={classes.nestedIcon} />
                                        )}
                                        <div className={classes.rightLabel}>
                                            <Typography className={classes.rightLabelText}>
                                                {right.label}
                                            </Typography>
                                            {right.note && (
                                                <Typography className={classes.rightNote}>
                                                    {right.note}
                                                </Typography>
                                            )}
                                        </div>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    color={"primary"}
                                                    checked={isGranted}
                                                    onChange={() => handleRightToggle(categoryId, right.id, right.dependsOn)}
                                                    disabled={isDependent && !parentGranted}
                                                />
                                            }
                                            label=""
                                        />
                                    </div>
                                );
                            })}
                        </AccordionDetails>
                    </Accordion>
                ))}
            </div>
        );
    };

    if (!customization || !licenseBase) {
        return null;
    }

    const licenseOptionsSection = licenseBase.sections.find(s => s.id === 'license-options');

    return (
        <Dialog
            PaperProps={{ classes: { root: classes.dialog } }}
            maxWidth="md"
            fullWidth
            keepMounted={false}
            open={open}
            scroll="paper"
            onClose={onClose}
        >
            <DialogTitle>
                <Typography component="h2" variant="h4" style={{ fontWeight: 500 }}>
                    {t("components.license_customization_dialog.pixa_nft_license_0_1")}
                </Typography>
                <div style={{ fontSize: '0.95rem', fontWeight: 400, color: '#bbb', marginTop: '4px' }}>
                    {t(
                        "components.license_customization_dialog.configure_the_terms_of_the_agreement_for"
                    )}
                </div>
            </DialogTitle>
            <div className={classes.dialogBody}>
                <DialogContent className={classes.dialogBody}>
                    {/* Info Box */}
                    <div className={classes.infoBox}>
                        <InfoOutlined className={classes.infoIcon} />
                        <Typography className={classes.infoText}>
                            {t(
                                "components.license_customization_dialog.customize_how_holders_and_visitors_can_use"
                            )}
                        </Typography>
                    </div>

                    {/* Rights Categories */}
                    {licenseOptionsSection?.rightsCategories?.map(category =>
                        renderRightsCategory(category)
                    )}

                    <Divider className={classes.divider} />

                    {/* Royalty Settings */}
                    <div className={classes.section}>
                        <Typography className={classes.sectionTitle}>
                            {t("components.license_customization_dialog.royalty_settings")}
                        </Typography>
                        <div className={classes.textFieldsContainer}>
                            <TextField
                                label={t("components.license_customization_dialog.royalty_percentage")}
                                type="number"
                                variant="outlined"
                                fullWidth
                                className={classes.textField}
                                value={customization.royaltyPercentage}
                                onChange={handleRoyaltyChange}
                                error={Boolean(errors.royalty)}
                                helperText={errors.royalty || "Percentage you'll receive on secondary sales (0-100)"}
                                inputProps={{ min: 0, max: 100, step: 0.1 }}
                            />
                        </div>
                    </div>

                    <Divider className={classes.divider} />

                    {/* Governing Law Settings */}
                    <div className={classes.section}>
                        <Typography className={classes.sectionTitle}>
                            {t("components.license_customization_dialog.governing_law_jurisdiction")}
                        </Typography>
                        <div className={classes.textFieldsContainer}>
                            <TextField
                                label={t("components.license_customization_dialog.jurisdiction")}
                                variant="outlined"
                                fullWidth
                                className={classes.textField}
                                value={customization.governingLaw.jurisdiction}
                                onChange={(e) => handleGoverningLawChange('jurisdiction', e.target.value)}
                                placeholder={t("components.license_customization_dialog.e_g_switzerland")}
                            />
                            <TextField
                                label={t("components.license_customization_dialog.court")}
                                variant="outlined"
                                fullWidth
                                className={classes.textField}
                                value={customization.governingLaw.court}
                                onChange={(e) => handleGoverningLawChange('court', e.target.value)}
                                placeholder={t("components.license_customization_dialog.e_g_zug_switzerland")}
                            />
                            <TextField
                                label={t("components.license_customization_dialog.arbitration_location")}
                                variant="outlined"
                                fullWidth
                                className={classes.textField}
                                value={customization.governingLaw.arbitrationLocation}
                                onChange={(e) => handleGoverningLawChange('arbitrationLocation', e.target.value)}
                                placeholder={t("components.license_customization_dialog.e_g_zug_switzerland")}
                            />
                            <TextField
                                label={t("components.license_customization_dialog.arbitration_rules")}
                                variant="outlined"
                                fullWidth
                                className={classes.textField}
                                value={customization.governingLaw.arbitrationRules}
                                onChange={(e) => handleGoverningLawChange('arbitrationRules', e.target.value)}
                                placeholder={t("components.license_customization_dialog.e_g_swiss_arbitration_centre")}
                            />
                        </div>
                    </div>

                    {/* Error Messages */}
                    {errors.dependencies && (
                        <Typography style={{ color: '#ff6b6b', fontSize: '0.875rem', marginTop: '16px' }}>
                            {errors.dependencies}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} style={{ color: '#999' }}>
                        {t("words.cancel")}
                    </Button>
                    <Button onClick={handleSave} color="primary" variant="contained" autoFocus>
                        {t("components.license_customization_dialog.save_generate_license")}
                    </Button>
                </DialogActions>
            </div>
        </Dialog>
    );
};

export default withStyles(styles)(LicenseCustomizationDialog);