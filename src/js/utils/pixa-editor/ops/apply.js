// @ts-check
/**
 * Bridges pure ops and the document: applies a palette or pixel result to a
 * layer through a transaction, honouring a mask, and builds the matching
 * preview override for the compositor.
 */

/**
 * Pixel count per palette index, over the mask when given.
 * @param {import('../model/Layer.js').Layer} layer @param {import('../model/Mask.js').Mask | null} mask
 */
export function usageIn(layer, mask) {
  if (!mask) return layer.usage();
  const counts = new Uint32Array(layer.palette.length), idx = layer.indices;
  mask.forEach((i) => { counts[idx[i]]++; });
  return counts;
}

/**
 * @param {import('../core/Transaction.js').Transaction} tx
 * @param {import('../model/Layer.js').Layer} layer
 * @param {import('../model/Mask.js').Mask | null} mask
 * @param {Uint32Array} colors new palette, same length as the layer's
 */
export function applyPalette(tx, layer, mask, colors) {
  if (!mask) {
    tx.replacePalette(layer, colors);
    return;
  }
  const n = colors.length, remap = new Int32Array(n).fill(-1), idx = layer.indices, old = layer.palette.colors;
  mask.forEach((i) => {
    const k = idx[i];
    if (k >= n || colors[k] === old[k]) return;
    let ni = remap[k];
    if (ni < 0) remap[k] = ni = layer.palette.add(colors[k]);
    if (ni !== k) tx.setIndex(layer, i, ni);
  });
}

/**
 * @param {import('../core/Transaction.js').Transaction} tx
 * @param {import('../model/Layer.js').Layer} layer
 * @param {import('../model/Mask.js').Mask | null} mask
 * @param {Uint32Array} rgba full-size result
 */
export function applyPixels(tx, layer, mask, rgba) {
  tx.writeRGBA(layer, rgba, mask);
}

/**
 * Compositor override for a palette preview.
 * @param {import('../model/Layer.js').Layer} layer @param {import('../model/Mask.js').Mask | null} mask @param {Uint32Array} colors
 */
export function palettePreview(layer, mask, colors) {
  if (!mask) return { layer, palette: colors };
  const rgba = layer.toRGBA(), idx = layer.indices;
  mask.forEach((i) => { rgba[i] = colors[idx[i]]; });
  return { layer, rgba };
}

/**
 * Compositor override for a pixel preview.
 * @param {import('../model/Layer.js').Layer} layer @param {import('../model/Mask.js').Mask | null} mask @param {Uint32Array} rgba
 */
export function pixelPreview(layer, mask, rgba) {
  if (!mask) return { layer, rgba };
  const base = layer.toRGBA();
  mask.forEach((i) => { base[i] = rgba[i]; });
  return { layer, rgba: base };
}
