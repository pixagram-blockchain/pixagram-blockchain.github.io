// @ts-check
/**
 * @pixa/editor — headless pixel-art editor core.
 *
 * Everything here runs without a DOM. The canvas view lives in
 * `@pixa/editor/view` (src/view/index.js).
 */
export { Editor, createEditor } from './core/Editor.js';
export { EventBus } from './core/EventBus.js';
export { Transaction } from './core/Transaction.js';
export { Commands } from './core/Commands.js';
export { History } from './history/History.js';

export { Document, MAX_SIZE } from './model/Document.js';
export { Layer } from './model/Layer.js';
export { Palette, MAX_COLORS } from './model/Palette.js';
export { Mask } from './model/Mask.js';
export { Floating } from './model/Floating.js';
export { makeReference, updateReference } from './model/Reference.js';
export { ColorCensus, capColors, countLayer, countRGBA } from './core/colors.js';
export { WorkerPool } from './worker/pool.js';
export { OPS as workerOps } from './worker/ops.js';

export * as color from './color/rgba.js';
export { fromHex, toHex, toCss, pack, unpack, over, toOklab, fromOklab, maxChroma } from './color/rgba.js';
export * as raster from './ops/raster.js';
export * as colorOps from './ops/color-ops.js';
export * as pixelOps from './ops/pixel-ops.js';
export { FILTER_NAMES, applyFilter, filterColor } from './ops/filters.js';
export { TIP_SHAPES, MAX_TIP_SIZE, tipOffsets, tipFromMask, tipOutline } from './brush/tips.js';

export { compositeRegion, compositeAll } from './render/composite.js';
export { FilterPreviews } from './render/filter-previews.js';
export { anchorOffset } from './commands/app.js';
export { buildContextMenu, menuItems, MENU_SECTIONS } from './menus/context-menu.js';
export { decodeImage, importPixelArt, detectPixelGrid, recoverPixelArt, importPhoto, countColors } from './io/import.js';
export { encodePNG, decodePNG, exportPNG, readPNGChunks, PROJECT_CHUNK } from './io/png.js';
export { serializeProject, parseProject, isProject, PROJECT_VERSION } from './io/project.js';
export { Autosave, openStore, requestPersistence } from './persist/autosave.js';
export * as interop from './interop/index.js';
