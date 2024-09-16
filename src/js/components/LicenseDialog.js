import * as React from "preact/compat";
import { useMemo, useState, useCallback } from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogTitle from "@material-ui/core/DialogTitle";
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CircularProgress from "@material-ui/core/CircularProgress";
import CheckBoxRounded from "@material-ui/icons/CheckBoxRounded";
import CloudDownload from "@material-ui/icons/CloudDownload";
import Cancel from "../icons/Cancel";
import SubdirectoryArrowRight from "@material-ui/icons/SubdirectoryArrowRight";

import generateLicensePdf from "../utils/licensePDF";
import {encodeIMG} from "../utils/encodeImage";
import { safeHTML } from "../utils/api/sanitizer";

import { t } from "../utils/text";

const styles = theme => ({
    dialog: {
        width: "min(640px, calc(100vw - 576px))",
        marginRight: "512px",
        backgroundColor: "#101010 !important",
        [theme.breakpoints.down("md")]: { width: "min(640px, calc(100vw - 64px))", marginRight: "32px" },
        [theme.breakpoints.down("xs")]: { marginRight: "0px", "&.MuiDialog-paper": { margin: "0px 0px", maxHeight: "100%", borderRadius: 0, width: "100%" } },
        "& .MuiDialogContent-root": { padding: "8px 32px" }
    },
    dialogBody: { overflowY: "auto", display: "flex", flexDirection: "column", minHeight: 0 },
    dialogTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
    downloadButton: { color: "#888", marginTop: 4, "&:hover": { color: "#fff" } },
    licenseContent: {
        fontSize: "0.875rem", lineHeight: 1.6, color: "#ddd", fontFamily: `'Normative Pro'`,
        "& h1, & h2, & h3, & h4, & h5, & h6, & strong, & th": { fontFamily: `'Industry Book'` },
        "& p, & span": { fontFamily: `'Normative Pro'` },
        "& h1": { fontSize: "1.75rem", fontWeight: 600, marginTop: theme.spacing(3), marginBottom: theme.spacing(2), borderBottom: "2px solid #ddd", paddingBottom: theme.spacing(1) },
        "& h2": { fontSize: "1.5rem", fontWeight: 600, marginTop: theme.spacing(3), marginBottom: theme.spacing(1.5) },
        "& h3": { fontSize: "1.25rem", fontWeight: 600, marginTop: 0, marginBottom: theme.spacing(1) },
        "& p": { marginBottom: theme.spacing(1.5), textAlign: "justify" },
        "& strong": { fontWeight: 600, color: "#fff" },
        "& ul, & ol": { marginBottom: 0, paddingLeft: theme.spacing(3) },
        "& li": { marginBottom: theme.spacing(0.5) }
    },
    rightsTable: {
        width: "100%", borderCollapse: "collapse", marginTop: theme.spacing(2), marginBottom: theme.spacing(4), fontSize: "0.875rem",
        "& th": { backgroundColor: "#191919", padding: theme.spacing(1.5), textAlign: "left", fontWeight: 600, borderBottom: `0px solid #ffffff12` },
        "& th:first-child": { borderRadius: "16px 0px 0px 16px" },
        "& th:last-child": { borderRadius: "0px 16px 16px 0px", textAlign: "left", width: "120px" },
        "& td": { padding: "4px 12px", borderBottom: `1px solid #ffffff12` },
        "& tr:last-child td": { borderBottom: "0px" }
    },
    categoryHeaderRow: { backgroundColor: "#0f0f0f !important", "& td": { fontFamily: `'Industry Book'`, paddingTop: "8px", paddingBottom: "4px", borderBottom: "0px !important", fontWeight: 600, fontSize: "0.95rem", color: "#fff", letterSpacing: "0.5px" } },
    categoryElementRow: {
        backgroundColor: "#0f0f0f !important", position: "relative",
        "& td": { fontFamily: `'Industry Book'`, paddingTop: "8px", paddingBottom: "4px", borderBottom: "0px !important", fontWeight: 600, fontSize: "0.95rem", color: "#fff", letterSpacing: "0.5px" },
        "&::after": { backgroundColor: "#ffffff00", borderRadius: "16px", content: '""', position: "absolute", top: 0, bottom: 0, left: 0, right: 0, width: "100%", height: "100%", transition: "background-color 320ms cubic-bezier(0.4, 0, 0.2, 1) 5ms" },
        "&:hover::after": { backgroundColor: "#ffffff0a" }
    },
    rightLabel: { fontWeight: 400 }, rightValue: { fontWeight: 600, textAlign: "left", minWidth: "120px" },
    granted: { color: "#fff" }, denied: { color: "#fff" },
    nestedRight: { paddingLeft: "21px !important", position: "relative" },
    nestedIcon: { fontSize: "1rem", marginRight: "4px", verticalAlign: "middle", color: "#666" },
    categorySection: { marginTop: theme.spacing(2), marginBottom: theme.spacing(2) },
    explanationBox: { backgroundColor: "#191919", padding: theme.spacing(2), borderRadius: "21px", marginBottom: theme.spacing(2), "& p": { margin: 0, marginBottom: theme.spacing(1), "&:last-child": { marginBottom: 0 } } },
    keyTerms: { display: "grid", gap: theme.spacing(1), marginTop: theme.spacing(1), paddingLeft: "16px", "& dt strong": { fontWeight: 600, color: "#ddd" }, "& dt span": { fontWeight: 400, color: "#bbb" } }
});

const WhiteCheckbox = withStyles({
    root: { color: "#ddd", '&$checked': { color: "#fff" } }, checked: {},
})((props) => <Checkbox disabled color="default" {...props} />);

const LicenseDialog = ({ classes, open, onClose, licenseBase, customization, data }) => {
    const [downloading, setDownloading] = useState(false);

    const handleDownloadPdf = useCallback(async () => {
        if (!licenseBase || downloading) return;
        setDownloading(true);

        try {
            const imageSource = data?.image;

            const t1 = performance.now();
            const pdfBytes = await generateLicensePdf(licenseBase, customization, {
                pageSize: 'a4',
                artworkImage: (imageSource && typeof imageSource === 'string' && imageSource.length > 0)
                    ? await encodeIMG(imageSource, "PNG", true)
                    : undefined,
            });
            console.log(`[LicensePDF] PDF: ${(performance.now()-t1).toFixed(0)}ms, ${(pdfBytes.length/1024).toFixed(1)}KB`);

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const title = data?.title || customization?.artworkInfo?.title || 'license';
            const author = data?.author || customization?.authorInfo?.username || '';
            a.download = `PIXA_LICENSE_${(title + (author ? '_by_' + author : '')).replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').substring(0, 80)}.pdf`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[LicensePDF] FATAL:', err);
        } finally {
            setDownloading(false);
        }
    }, [licenseBase, customization, data, downloading]);

    const renderMarkdown = (md) => { try { return micromark(md, { extensions: [gfm()], htmlExtensions: [gfmHtml()] }); } catch { return '<p>Error</p>'; } };
    const applyCustomization = (content, c) => {
        if (!c) return content; let r = content;
        if (c.royaltyPercentage !== undefined) r = r.replace('{royaltyPercentage}', c.royaltyPercentage);
        if (c.governingLaw) { const g = c.governingLaw; r = r.replace('{jurisdiction}', g.jurisdiction||'[Not Specified]').replace('{court}', g.court||'[Not Specified]').replace('{arbitrationLocation}', g.arbitrationLocation||'[Not Specified]').replace('{arbitrationRules}', g.arbitrationRules||'[Not Specified]'); }
        return r;
    };
    const groupRightsByCategory = (rights) => {
        const cats = {}, order = ['basic','commercial','creative','digital','media','display','educational','advanced'];
        rights.forEach(r => { if (!cats[r.category]) cats[r.category] = { label: r.categoryLabel || r.category.charAt(0).toUpperCase()+r.category.slice(1), rights: [] }; cats[r.category].rights.push(r); });
        return order.filter(c => cats[c]).map(c => ({ category: c, ...cats[c] }));
    };
    const renderRightsTable = (rightsCategory, customization) => {
        const configKey = rightsCategory.id === 'holder-rights' ? 'holderRights' : 'visitorRights';
        const rc = customization?.rightsConfiguration?.[configKey] || {};
        return (
            <div className={classes.categorySection}>
                <h3>{rightsCategory.title}</h3>
                <table className={classes.rightsTable}>
                    <thead><tr><th>{t("components.license_dialog.right")}</th><th>{t("components.license_dialog.permission")}</th></tr></thead>
                    <tbody>
                    {groupRightsByCategory(rightsCategory.rights).map(({ category, label, rights: catRights }) => (
                        <React.Fragment key={category}>
                            <tr className={classes.categoryHeaderRow}><td colSpan="2">{label}</td></tr>
                            {catRights.map(right => {
                                const isGranted = rc[right.id] !== undefined ? rc[right.id] : right.defaultValue;
                                const dep = Boolean(right.dependsOn);
                                if (right.dependsOn && rc[right.dependsOn] !== true) return null;
                                return (
                                    <tr key={right.id} className={classes.categoryElementRow}>
                                        <td className={`${classes.rightLabel} ${dep ? classes.nestedRight : ''}`}>
                                            {dep && <SubdirectoryArrowRight className={classes.nestedIcon} />}
                                            <span style={{ marginTop: '4px', display: dep ? "inline" : "block" }}>{right.label}</span>
                                            {right.note && <span style={{ fontSize: '0.75rem', display: "block", color: '#aaa', marginBottom: '4px', fontStyle: 'italic' }}>{right.note}</span>}
                                        </td>
                                        <td className={`${classes.rightValue} ${isGranted ? classes.granted : classes.denied}`}>
                                            <FormControlLabel control={<WhiteCheckbox checked={isGranted} icon={<Cancel />} checkedIcon={<CheckBoxRounded />} style={{ marginRight: "8px" }} />} label={isGranted ? 'CAN' : "CAN'T"} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </React.Fragment>
                    ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderLicense = useMemo(() => {
        if (!licenseBase) return <DialogContentText>{t("components.license_dialog.no_license_data_available")}</DialogContentText>;
        return (
            <>
                {licenseBase.explanation && (
                    <div className={classes.explanationBox}>
                        <h3 style={{ fontSize: "1.5rem", color: "#fff" }}>{t("components.license_dialog.about_this_license")}</h3>
                        <p><strong>{t("components.license_dialog.purpose")}</strong> {licenseBase.explanation.purpose}</p>
                        <p><strong>{t("components.license_dialog.how_it_works")}</strong> {licenseBase.explanation.mechanism}</p>
                        {licenseBase.explanation.keyTerms && (<React.Fragment><p><strong>{t("components.license_dialog.key_terms")}</strong></p><ul className={classes.keyTerms}>{Object.entries(licenseBase.explanation.keyTerms).map(([t, d]) => (<li key={t}><strong>{t}: </strong><span>{d}</span></li>))}</ul></React.Fragment>)}
                    </div>
                )}
                {licenseBase.sections.map(section => {
                    if (section.type === 'intro') return <div key={section.id}><h1>{section.title}</h1><p>{section.content}</p></div>;
                    if (section.type === 'customizable' && section.id === 'license-options') return (<div key={section.id}><h2>{section.number}. {section.title}</h2><p>{section.content}</p>{section.rightsCategories?.map(cat => renderRightsTable(cat, customization))}</div>);
                    if (section.type === 'customizable') return (<div key={section.id}><h2>{section.number}. {section.title}</h2><div dangerouslySetInnerHTML={{ __html: safeHTML(renderMarkdown(applyCustomization(section.content, customization))) }} /></div>);
                    return <div key={section.id}><h2>{section.number}. {section.title}</h2><div dangerouslySetInnerHTML={{ __html: safeHTML(renderMarkdown(section.content)) }} /></div>;
                })}
            </>
        );
    }, [licenseBase, customization, classes]);

    return (
        <Dialog PaperProps={{ classes: { root: classes.dialog } }} maxWidth="md" fullWidth keepMounted={false} open={open} scroll="paper" onClose={onClose}>
            <DialogTitle disableTypography>
                <div className={classes.dialogTitleRow}>
                    <div>
                        <Typography component="h2" variant="h4" style={{ fontWeight: 500 }}>{licenseBase?.shortName || 'License Agreement'}</Typography>
                        {customization?.isCustomized && (
                            <div style={{ fontSize: '1.0rem', fontWeight: 400, color: '#bbb', marginTop: '4px' }}>
                                {t("components.license_dialog.customized_for")} <Tooltip arrow title={customization.artworkInfo?.title}><strong>0x8BE5125</strong></Tooltip>from <Tooltip arrow title={customization.authorInfo?.name || 'Author'}><strong>@{customization.authorInfo?.username || 'username'}</strong></Tooltip>
                            </div>
                        )}
                    </div>
                    <Tooltip arrow title={t("components.license_dialog.download_as_pdf")}>
                        <span>
                            <IconButton className={classes.downloadButton} onClick={handleDownloadPdf} disabled={downloading || !licenseBase}>
                                {downloading ? <CircularProgress size={24} style={{ color: "#888" }} /> : <CloudDownload />}
                            </IconButton>
                        </span>
                    </Tooltip>
                </div>
            </DialogTitle>
            <DialogContent className={classes.dialogBody}><div className={classes.licenseContent}>{renderLicense}</div></DialogContent>
            <DialogActions><Button onClick={onClose} color="primary" autoFocus>{t("words.close")}</Button></DialogActions>
        </Dialog>
    );
};

export default withStyles(styles)(LicenseDialog);