// @ts-check
/**
 * Filter thumbnails in context: the document is reduced once (nearest
 * neighbour, longest side `size`), then each filter only transforms the
 * active layer's palette and the small copy is composited. Results are cached
 * on the layers' revisions, the size and the intensity, so calling it after
 * every change costs nothing until something visible changes.
 */
import { Document } from '../model/Document.js';
import { Layer } from '../model/Layer.js';
import { applyFilter, FILTER_NAMES } from '../ops/filters.js';
import { compositeAll } from './composite.js';

export class FilterPreviews {
  constructor() {
    this.smallKey = '';
    /** @type {Document | null} */ this.small = null;
    this.key = '';
    /** @type {Map<string, { rgba: Uint32Array, width: number, height: number }>} */ this.result = new Map();
  }

  /**
   * @param {import('../model/Document.js').Document} doc
   * @param {{ size?: number, intensity?: number, names?: string[] }} [o]
   * @returns {Map<string, { rgba: Uint32Array, width: number, height: number }>}
   */
  render(doc, o = {}) {
    const size = Math.max(1, Math.round(o.size ?? 96)), intensity = o.intensity ?? 1, names = o.names ?? FILTER_NAMES;
    const layersKey = doc.layers.map((l) => `${l.id}:${l.revision}:${l.visible ? 1 : 0}:${l.opacity}`).join('|');
    const smallKey = `${doc.width}x${doc.height}|${size}|${layersKey}`;
    const key = `${smallKey}|${doc.activeLayerId}|${intensity}|${names.join(',')}`;
    if (key === this.key) return this.result;
    if (smallKey !== this.smallKey || !this.small) {
      this.small = reduce(doc, size);
      this.smallKey = smallKey;
    }
    const small = this.small;
    small.activeLayerId = doc.activeLayerId;
    const active = small.activeLayer, base = active.palette.view().slice();
    const out = new Map();
    for (const name of names) {
      out.set(name, { rgba: compositeAll(small, { layer: active, palette: applyFilter(base, name, intensity) }, { includeFloating: false }), width: small.width, height: small.height });
    }
    this.key = key;
    this.result = out;
    return out;
  }
}

/**
 * Nearest-neighbour copy of a document with the longest side at most `size`;
 * layers share their palettes with the original.
 * @param {import('../model/Document.js').Document} doc @param {number} size
 */
function reduce(doc, size) {
  const s = Math.min(1, size / Math.max(doc.width, doc.height));
  const tw = Math.max(1, Math.round(doc.width * s)), th = Math.max(1, Math.round(doc.height * s));
  const layers = doc.layers.map((l) => {
    const idx = new Uint16Array(tw * th);
    for (let y = 0; y < th; y++) {
      const sy = Math.min(doc.height - 1, Math.floor((y + 0.5) / s));
      for (let x = 0; x < tw; x++) idx[y * tw + x] = l.indices[sy * doc.width + Math.min(doc.width - 1, Math.floor((x + 0.5) / s))];
    }
    return new Layer({ id: l.id, name: l.name, width: tw, height: th, palette: l.palette.clone(), indices: idx, visible: l.visible, opacity: l.opacity });
  });
  return new Document({ width: tw, height: th, layers });
}
