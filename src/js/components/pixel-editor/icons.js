// ============================================================================
// pixel-editor/icons.js — the glyphs @material-ui/icons v4 does not ship
//
// Same 24 px grid and weight as the Material icons around them, made with
// createSvgIcon so they take color, fontSize and className like any MUI icon.
// Scissors is the Material "content_cut" glyph (Apache 2.0), which v4 lacks;
// the others are drawn for the editor.
// ============================================================================

import * as React from "preact/compat";
import createSvgIcon from "@material-ui/core/utils/createSvgIcon";

// A dashed square frame: 2 px dashes along a 3..21 box. Shared by the
// "whole layer" selection glyphs.
const DASHED_FRAME = "M3 3h2v2H3zM7 3h2v2H7zM11 3h2v2h-2zM15 3h2v2h-2zM19 3h2v2h-2z" +
    "M3 19h2v2H3zM7 19h2v2H7zM11 19h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z" +
    "M3 7h2v2H3zM3 11h2v2H3zM3 15h2v2H3zM19 7h2v2h-2zM19 11h2v2h-2zM19 15h2v2h-2z";

export const EraserIcon = createSvgIcon(
    <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84L13.41 3.56c.79-.78 2.05-.78 2.83 0zM4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z" />,
    "Eraser"
);

// Same colour area: a wand with sparkles.
export const MagicWandIcon = createSvgIcon(
    <React.Fragment>
        <path d="M3.5 19.1 14.8 7.8l1.41 1.41L4.91 20.52z" />
        <path d="M17.5 2l.77 1.73L20 4.5l-1.73.77L17.5 7l-.77-1.73L15 4.5l1.73-.77z" />
        <path d="M20.5 9.5l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5z" />
        <path d="M11 3.5l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5z" />
    </React.Fragment>,
    "MagicWand"
);

// Same colour, whole layer: a drop inside a dashed frame.
export const ColorSelectIcon = createSvgIcon(
    <React.Fragment>
        <path d={DASHED_FRAME} />
        <path d="M12 7.2s-3.6 4-3.6 6.4a3.6 3.6 0 0 0 7.2 0c0-2.4-3.6-6.4-3.6-6.4z" />
    </React.Fragment>,
    "ColorSelect"
);

// Line selection: a dashed diagonal stroke.
export const LineSelectIcon = createSvgIcon(
    <path d="M3 18.6 5.4 21l3.3-3.3-2.4-2.4zM8.5 13.1l2.4 2.4 3.3-3.3-2.4-2.4zM14 7.6l2.4 2.4 3.3-3.3-2.4-2.4zM19.1 2.5 21.5 4.9 20.4 6l-2.4-2.4z" />,
    "LineSelect"
);

// Selection brush: a dashed tip outline around a dot.
export const BrushSelectIcon = createSvgIcon(
    <React.Fragment>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3.1 2.2" />
        <circle cx="12" cy="12" r="3" />
    </React.Fragment>,
    "BrushSelect"
);

// Invert selection: half of a dashed frame filled.
export const InvertSelectionIcon = createSvgIcon(
    <React.Fragment>
        <path d={DASHED_FRAME} />
        <path d="M17 7v10H7z" />
    </React.Fragment>,
    "InvertSelection"
);

// Pixel-perfect: a one-pixel staircase, the stroke it guarantees.
export const PixelPerfectIcon = createSvgIcon(
    <path d="M3 17h4v4H3zM7 13h4v4H7zM11 9h4v4h-4zM15 5h4v4h-4zM19 3h2v2h-2z" />,
    "PixelPerfect"
);

export const ScissorsIcon = createSvgIcon(
    <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z" />,
    "Scissors"
);

// Mirror axis tool: two mirrored halves around a dashed axis.
export const MirrorAxisIcon = createSvgIcon(
    <React.Fragment>
        <path d="M11 2h2v3h-2zM11 7h2v3h-2zM11 12h2v3h-2zM11 17h2v3h-2z" />
        <path d="M9 6v12L3 18zM15 6v12h6z" />
    </React.Fragment>,
    "MirrorAxis"
);
