import * as React from "preact/compat";
import withStyles from "@material-ui/core/styles/withStyles";
import Accordion from "@material-ui/core/Accordion";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import Typography from "@material-ui/core/Typography";
import JSLoader from "../utils/JSLoader";
import { safeHTML } from "../utils/api/sanitizer";

import { t } from "../utils/text";
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';

import { withLanguage } from "../utils/withLanguage";
/** Real markdown parsing, then sanitisation — the order LicenseDialog uses. */
function renderWikiMarkdown(md) {
    if (!md) return "";
    try {
        return micromark(md, { extensions: [gfm()], htmlExtensions: [gfmHtml()] });
    } catch (e) {
        return "";
    }
}


const styles = theme => ({
    container: {
        padding: '24px',
        overflowY: 'auto',
        color: '#ffffff',
        maxWidth: '1200px',
        margin: '0 auto',
    },
    partSection: {
        marginBottom: '48px',
    },
    partTitle: {
        fontSize: '32px',
        fontWeight: 'bold',
        marginBottom: '24px',
        color: "#fff",
        borderBottom: '2px solid #333',
        paddingBottom: '12px',
    },
    accordion: {
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        marginBottom: '16px',
        borderRadius: '8px',
        '&:before': {
            display: 'none',
        },
    },
    accordionSummary: {
        backgroundColor: '#242424',
        borderRadius: '8px',
        '&:hover': {
            backgroundColor: '#2a2a2a',
        },
    },
    sectionTitle: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#ffffff',
    },
    accordionDetails: {
        padding: '24px',
        backgroundColor: '#1a1a1a',
    },
    markdownContent: {
        '& h1': {
            fontSize: '28px',
            fontWeight: 'bold',
            marginTop: '24px',
            marginBottom: '16px',
            color: '#ffffff',
        },
        '& h2': {
            fontSize: '24px',
            fontWeight: 'bold',
            marginTop: '20px',
            marginBottom: '14px',
            color: '#f0f0f0',
        },
        '& h3': {
            fontSize: '20px',
            fontWeight: '600',
            marginTop: '16px',
            marginBottom: '12px',
            color: '#e0e0e0',
        },
        '& h4': {
            fontSize: '18px',
            fontWeight: '600',
            marginTop: '12px',
            marginBottom: '8px',
            color: '#d0d0d0',
        },
        '& p': {
            fontSize: '16px',
            lineHeight: '1.8',
            marginBottom: '16px',
            color: '#d1d5db',
        },
        '& strong': {
            color: '#ffffff',
            fontWeight: 'bold',
        },
        '& em': {
            fontStyle: 'italic',
            color: '#e0e0e0',
        },
        '& ul, & ol': {
            marginLeft: '24px',
            marginBottom: '16px',
            '& li': {
                marginBottom: '8px',
                lineHeight: '1.6',
                color: '#d1d5db',
            },
        },
        '& blockquote': {
            borderLeft: '4px solid #4a5568',
            paddingLeft: '16px',
            marginLeft: '0',
            marginBottom: '16px',
            fontStyle: 'italic',
            color: '#9ca3af',
        },
        '& code': {
            backgroundColor: '#2d3748',
            padding: '2px 6px',
            borderRadius: '3px',
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#63b3ed',
        },
        '& pre': {
            backgroundColor: '#1a202c',
            padding: '16px',
            borderRadius: '6px',
            overflowX: 'auto',
            marginBottom: '16px',
            '& code': {
                backgroundColor: 'transparent',
                padding: '0',
                color: '#a0aec0',
                fontSize: '14px',
                lineHeight: '1.6',
            },
        },
        '& table': {
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '16px',
            '& th': {
                backgroundColor: '#2d3748',
                padding: '12px',
                textAlign: 'left',
                fontWeight: 'bold',
                borderBottom: '2px solid #4a5568',
                color: '#ffffff',
            },
            '& td': {
                padding: '12px',
                borderBottom: '1px solid #2d3748',
                color: '#d1d5db',
            },
        },
        '& hr': {
            border: 'none',
            borderTop: '1px solid #4a5568',
            marginTop: '24px',
            marginBottom: '24px',
        },
    },
    navigationMenu: {
        position: 'sticky',
        top: '24px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '24px',
    },
    navItem: {
        padding: '8px 12px',
        cursor: 'pointer',
        borderRadius: '4px',
        transition: 'background-color 0.3s',
        '&:hover': {
            backgroundColor: '#2a2a2a',
        },
    },
    activeNavItem: {
        backgroundColor: '#2a2a2a',
        fontWeight: 'bold',
    },
});

class WikiViewer extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            classes: props.classes,
            wikiData: null,
            expandedSections: {},
            activePart: 'part-1',
            parsedContent: {},
        };
    }

    componentDidMount() {
        // Load wiki data asynchronously
        this.loadWikiData();
    }



    loadWikiData = async () => {
        // Simulated async load - replace with actual data loading
        const wikiData = await this.fetchWikiData();
        this.setState({ wikiData }, () => {
            this.parseAllContent();
        });
    };

    fetchWikiData = async () => {
        return await JSLoader( () => import("../data/wiki")).then((d2) => {
            return d2.default();
        });
    };

    parseAllContent = () => {
        const { wikiData } = this.state;
        if (!wikiData) return;

        const parsedContent = {};
        wikiData.wiki.parts.forEach(part => {
            part.sections.forEach(section => {
                // Sanitize once at parse time so the innerHTML sink below
                // stays inert even if the wiki source ever becomes remote
                // or community-editable.
                // Was: safeHTML(this.markdownParser(section.content))
                //
                // markdownParser is ~180 lines of regex replacers with
                // inconsistent escaping: the CODE paths call escapeHtml, but
                // boldReplacer/italicReplacer/headingReplacer/blockquoteReplacer
                // concatenate raw, and linkReplacer built href="' + tagURL + '"
                // with no scheme check and no quote escaping. safeHTML was the
                // only thing standing between that and the DOM.
                //
                // micromark is already a project dependency (LicenseDialog,
                // LexicalTextEditorDialog). Parse properly, then sanitise.
                parsedContent[section.id] = safeHTML(renderWikiMarkdown(section.content));
            });
        });

        this.setState({ parsedContent });
    };

    handleAccordionChange = (sectionId) => (event, isExpanded) => {
        this.setState(prevState => ({
            expandedSections: {
                ...prevState.expandedSections,
                [sectionId]: isExpanded
            }
        }));
    };

    handlePartNavigation = (partId) => {
        this.setState({ activePart: partId });
        const element = document.getElementById(partId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    render() {
        const { classes } = this.state;
        const { wikiData, expandedSections, activePart, parsedContent } = this.state;

        if (!wikiData) {
            return (
                <div className={classes.container}>
                    <Typography>{t("components.wiki_viewer.loading_wiki_content")}</Typography>
                </div>
            );
        }

        return (
            <div className={classes.container}>
                <div className={classes.navigationMenu}>
                    {wikiData.wiki.parts.map(part => (
                        <div
                            key={part.id}
                            className={`${classes.navItem} ${activePart === part.id ? classes.activeNavItem : ''}`}
                            onClick={() => this.handlePartNavigation(part.id)}
                        >
                            {part.title}
                        </div>
                    ))}
                </div>

                {wikiData.wiki.parts.map(part => (
                    <div key={part.id} id={part.id} className={classes.partSection}>
                        <Typography className={classes.partTitle}>
                            {part.title}
                        </Typography>

                        {part.sections.map(section => (
                            <Accordion
                                key={section.id}
                                expanded={expandedSections[section.id] || false}
                                onChange={this.handleAccordionChange(section.id)}
                                className={classes.accordion}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon style={{ color: '#ffffff' }} />}
                                    className={classes.accordionSummary}
                                >
                                    <Typography className={classes.sectionTitle}>
                                        {section.title}
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails className={classes.accordionDetails}>
                                    <div
                                        className={classes.markdownContent}
                                        dangerouslySetInnerHTML={{
                                            __html: safeHTML(parsedContent[section.id] || 'Loading...')
                                        }}
                                    />
                                </AccordionDetails>
                            </Accordion>
                        ))}
                    </div>
                ))}
            </div>
        );
    }
}

export default withLanguage(withStyles(styles)(WikiViewer));