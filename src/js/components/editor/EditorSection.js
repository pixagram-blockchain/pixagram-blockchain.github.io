import React from 'preact/compat';

// Lexical core imports
import { LexicalComposer } from '@lexical/react/LexicalComposer.js';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin.js';
import { ContentEditable } from '@lexical/react/LexicalContentEditable.js';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin.js';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin.js';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary.js';
import { ListPlugin } from '@lexical/react/LexicalListPlugin.js';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin.js';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin.js';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin.js';

import { lexicalTheme, lexicalNodes, EditorRefPlugin, KeyboardPlugin, InitializePlugin, ToolbarStatePlugin, ImageAutoConvertPlugin, EDITOR_TRANSFORMERS } from './lexicalConfig';
import EditorHeader from './EditorHeader';
import FloatingFormatBar from './FloatingFormatBar';
import RadialContextMenu from './RadialContextMenu';
import ImageDropPlugin from './ImageDropPlugin';

import { t, useLanguage } from "../../utils/text";

export const editorSectionStyles = (theme) => ({
    editorSection: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "#171717",
        paddingLeft: 32,
        paddingRight: 16,
        borderRadius: "0px 32px 0px 0px",
        [theme.breakpoints.down("sm")]: {
            paddingLeft: 8,
            paddingRight: 8,
            borderRadius: "0px",
            overflow: "overlay",
            minHeight: "100%",
            maxHeight: "100%",
            position: "relative"
        }
    },
    editorWrapper: {
        position: "initial",
        flex: 1,
        margin: "16px 24px 0px 24px",
        backgroundColor: "#0a0a0a",
        borderRadius: "32px 32px 0px 0px",
        cursor: "text",
        [theme.breakpoints.down("sm")]: {
            borderRadius: "24px 24px 0px 0px",
            margin: "8px 12px 0px 12px",
        },
        "&.markdown": {
            overflow: "hidden",
            "& textarea": {
                padding: 24
            }
        },
        "&.visual": {
            overflow: "auto",
            "& > div": {
                padding: 24,
            }
        },
        "& .DraftEditor-root": {
            minHeight: "100%",
            color: "#e0e0e0",
            fontSize: 16,
            lineHeight: 1.6
        },
        "& .DraftEditor-editorContainer": {
            minHeight: "100%"
        },
        "& .public-DraftEditor-content": {
            minHeight: "100%"
        },
        "& .public-DraftStyleDefault-block": {
            marginBottom: "1em"
        },
        "& h1": {
            fontSize: "2.5em",
            fontWeight: 600,
            color: "#fff",
            margin: "0.5em 0"
        },
        "& h2": {
            fontSize: "2em",
            fontWeight: 600,
            color: "#fff",
            margin: "0.5em 0"
        },
        "& h3": {
            fontSize: "1.5em",
            fontWeight: 600,
            color: "#fff",
            margin: "0.5em 0"
        },
        "& blockquote": {
            borderLeft: "3px solid rgba(255,255,255,0.2)",
            paddingLeft: 16,
            margin: "1em 0",
            color: "rgba(255,255,255,0.8)"
        },
        "& pre": {
            backgroundColor: "rgba(255,255,255,0.05)",
            padding: 16,
            borderRadius: 8,
            overflow: "auto",
            fontFamily: "monospace"
        },
        "& a": {
            color: "#ffffff",
            textDecoration: "underline"
        },
        "& textarea": {
            width: "100%",
            minHeight: "100%",
            height: "100%",
            backgroundColor: "transparent",
            border: "none",
            outline: "none",
            color: "#e0e0e0",
            fontSize: 16,
            lineHeight: 1.6,
            fontFamily: "monospace",
            resize: "none",
            padding: 0
        },
        "& table": {
            width: "100%",
            borderCollapse: "collapse",
            margin: "1.5em 0",
            backgroundColor: "rgba(255,255,255,0.02)",
            borderRadius: 8,
            overflow: "hidden"
        },
        "& th, & td": {
            padding: 12,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            textAlign: "left"
        },
        "& th": {
            fontWeight: 600,
            color: "#fff",
            backgroundColor: "rgba(255,255,255,0.05)"
        },
        "& tr:hover": {
            backgroundColor: "rgba(255,255,255,0.03)"
        },
        // Lexical-specific styles that mimic Draft.js
        "& .lexical-editor-root": {
            minHeight: "100%",
            color: "#e0e0e0",
            fontSize: 16,
            lineHeight: 1.6,
            outline: "none"
        },
        "& .lexical-bold": {
            fontWeight: "bold"
        },
        "& .lexical-italic": {
            fontStyle: "italic"
        },
        "& .lexical-underline": {
            textDecoration: "underline"
        },
        "& .lexical-strikethrough": {
            textDecoration: "line-through"
        },
        "& .lexical-code": {
            backgroundColor: "rgba(255,255,255,0.1)",
            padding: "2px 4px",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: "0.9em"
        },
        "& .lexical-link": {
            color: "#90caf9",
            textDecoration: "none",
            "&:hover": {
                textDecoration: "underline"
            }
        },
        "& .lexical-image": {
            display: "inline-block",
            maxWidth: "100%",
        },
        "& .lexical-image img": {
            display: "block",
            maxWidth: "100%",
            height: "auto",
            borderRadius: 12,
            margin: "0.5em 0"
        }
    },
});

// Hoisted static styles — were inline object literals re-created on every
// render of the editor subtree.
const EDITOR_BODY_WRAPPER_STYLE = { height: "100%" };
const CONTENT_EDITABLE_STYLE = { minHeight: '100%', outline: 'none' };

// ── EditorBody ───────────────────────────────────────────────────────────
// The Lexical composer subtree, isolated behind its own memo. EditorSection
// itself must re-render on every TITLE / DESCRIPTION keystroke (the
// controlled inputs in EditorHeader live above), and before this split each
// of those keystrokes also reconciled the entire composer + plugin tree for
// no reason — none of its inputs had changed. Behind this boundary, the
// composer only re-renders on a mode switch, a draft load (initialMarkdown),
// or markdown-mode keystrokes (markdownSource is the controlled textarea
// value there). All handlers are stable class methods on the parent dialog.
const EditorBody = React.memo(({
                                   editorMode,
                                   initialMarkdown,
                                   markdownSource,
                                   editorRef,
                                   onChange,
                                   onMarkdownChange,
                                   onSave,
                                   onLink,
                                   onImage,
                                   onImageFiles,
                                   onToggleBlockType,
                                   onToolbarStateChange
                               }) => {
    const initialConfig = React.useMemo(() => ({
        namespace: 'PixagramEditor',
        theme: lexicalTheme,
        nodes: lexicalNodes,
        onError: (error) => {
            console.error('Lexical error:', error);
        },
    }), []);

    return editorMode === 'visual' ? (
        <LexicalComposer initialConfig={initialConfig}>
            <RichTextPlugin
                contentEditable={
                    <ContentEditable
                        className="DraftEditor-root lexical-editor-root"
                        style={CONTENT_EDITABLE_STYLE}
                    />
                }
                ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <LinkPlugin />
            <TablePlugin />
            <MarkdownShortcutPlugin transformers={EDITOR_TRANSFORMERS} />
            <OnChangePlugin onChange={onChange} ignoreSelectionChange={true} />
            <EditorRefPlugin editorRef={editorRef} />
            <KeyboardPlugin onSave={onSave} onLink={onLink} />
            <ToolbarStatePlugin onStateChange={onToolbarStateChange} />
            <ImageAutoConvertPlugin />
            <FloatingFormatBar onLink={onLink} onToggleBlockType={onToggleBlockType} />
            <ImageDropPlugin onImageFiles={onImageFiles} />
            <RadialContextMenu
                onLink={onLink}
                onImage={onImage}
                onToggleBlockType={onToggleBlockType}
            />
            {initialMarkdown && <InitializePlugin initialMarkdown={initialMarkdown} />}
        </LexicalComposer>
    ) : (
        <textarea
            value={markdownSource}
            onChange={onMarkdownChange}
            placeholder={t("components.editor_section.write_your_story_in_markdown")}
            spellCheck
        />
    );
});

const EditorSection = React.memo(({
                                      classes,
                                      editorMode,
                                      title,
                                      description,
                                      initialMarkdown,
                                      markdownSource,
                                      editorRef,
                                      onTitleChange,
                                      onDescriptionChange,
                                      onChange,
                                      onMarkdownChange,
                                      onFocus,
                                      onSave,
                                      onLink,
                                      onImage,
                                      onImageFiles,
                                      onToggleBlockType,
                                      onToolbarStateChange
                                  }) => {
    useLanguage();
    return (
    <div className={classes.editorSection}>
        <EditorHeader
            classes={classes}
            title={title}
            description={description}
            onTitleChange={onTitleChange}
            onDescriptionChange={onDescriptionChange}
        />
        <div className={classes.editorWrapper + " " + editorMode} onClick={onFocus}>
            <div style={EDITOR_BODY_WRAPPER_STYLE}>
                <EditorBody
                    editorMode={editorMode}
                    initialMarkdown={initialMarkdown}
                    markdownSource={markdownSource}
                    editorRef={editorRef}
                    onChange={onChange}
                    onMarkdownChange={onMarkdownChange}
                    onSave={onSave}
                    onLink={onLink}
                    onImage={onImage}
                    onImageFiles={onImageFiles}
                    onToggleBlockType={onToggleBlockType}
                    onToolbarStateChange={onToolbarStateChange}
                />
            </div>
        </div>
    </div>
);
});

export default EditorSection;
