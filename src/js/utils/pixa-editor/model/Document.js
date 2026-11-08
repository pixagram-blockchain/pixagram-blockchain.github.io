// @ts-check
import { Layer, newId } from './Layer.js';
import { Mask } from './Mask.js';
import { over } from '../color/rgba.js';
import { compositeAll } from '../render/composite.js';

export const MAX_SIZE = 2048;

/**
 * The only root of editable state. Change it through transactions; read it
 * freely.
 */
export class Document {
  /**
   * @param {{ width: number, height: number, layers?: Layer[], id?: string, name?: string }} o
   */
  constructor(o) {
    const w = o.width | 0, h = o.height | 0;
    if (w < 1 || h < 1 || w > MAX_SIZE || h > MAX_SIZE) {
      throw new RangeError(`Document size must be 1..${MAX_SIZE} per side, got ${w} x ${h}`);
    }
    this.id = o.id || newId('doc');
    this.name = o.name || 'Untitled';
    this.width = w;
    this.height = h;
    /** @type {Layer[]} bottom to top */
    this.layers = o.layers && o.layers.length ? o.layers : [Layer.blank(w, h, 'Layer 1')];
    this.activeLayerId = this.layers[this.layers.length - 1].id;
    this.selection = new Mask(w, h);
    /** @type {import('./Floating.js').Floating | null} */
    this.floating = null;
    /** @type {import('./Reference.js').Reference | null} reference image, shown but never exported */
    this.reference = null;
  }

  get activeLayer() {
    return this.layers.find((l) => l.id === this.activeLayerId) || this.layers[this.layers.length - 1];
  }

  get activeIndex() {
    const i = this.layers.findIndex((l) => l.id === this.activeLayerId);
    return i < 0 ? this.layers.length - 1 : i;
  }

  /** @param {string} id */
  layerById(id) {
    return this.layers.find((l) => l.id === id) || null;
  }

  /** @param {string} id */
  indexOfLayer(id) {
    return this.layers.findIndex((l) => l.id === id);
  }

  /**
   * Composite colour of one pixel: visible layers bottom to top, the floating
   * layer just above the active one.
   * @param {number} x @param {number} y @param {{ includeFloating?: boolean }} [o]
   */
  compositeAt(x, y, o = {}) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    const i = y * this.width + x;
    let c = 0;
    const active = this.activeIndex, fl = o.includeFloating === false || this.floating?.pristine ? null : this.floating;
    for (let k = 0; k < this.layers.length; k++) {
      const l = this.layers[k];
      if (l.visible && l.opacity > 0) c = over(c, l.getColor(i), Math.round(l.opacity * 255));
      if (fl && k === active) {
        const f = fl.colorAt(x, y);
        if (f) c = over(c, f, 255);
      }
    }
    return c;
  }

  /** Whole flattened image as packed colours. @param {{ includeFloating?: boolean }} [o] */
  compositeRGBA(o = {}) {
    return compositeAll(this, null, o);
  }
}
