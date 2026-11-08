// @ts-check
/**
 * One bit per pixel, stored exactly like @asaitama/boolean-array's SetFixed:
 * bit i (i = y * width + x) lives in word i >>> 5 at position i & 31, and the
 * last word of `data` holds the bit length. `toSetFixed()` therefore hands the
 * very same buffer to SetFixed, and `Mask.fromSetFixed()` copies one array.
 *
 * Everything heavier than a single bit works on whole 32-bit words.
 */

/** @type {Map<string, {col0: Uint32Array, colLast: Uint32Array, interior: Uint32Array}>} */
const GEOMETRY = new Map();

function popcount(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export class Mask {
  /** @param {number} width @param {number} height @param {Uint32Array} [data] */
  constructor(width, height, data) {
    this.width = width | 0;
    this.height = height | 0;
    this.size = this.width * this.height;
    this.wordCount = (this.size + 32) >>> 5;
    if (data) {
      if (data.length !== this.wordCount + 1) throw new Error('Mask data has the wrong length');
      this.data = data;
    } else {
      this.data = new Uint32Array(this.wordCount + 1);
    }
    this.data[this.wordCount] = this.size;
    /** Bumped on every change; caches (outline, preview) key on it. */
    this.version = 0;
  }

  // ------------------------------------------------------------ bits

  /** @param {number} i */
  get(i) {
    return (this.data[i >>> 5] >>> (i & 31)) & 1;
  }

  /** @param {number} x @param {number} y */
  has(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const i = y * this.width + x;
    return ((this.data[i >>> 5] >>> (i & 31)) & 1) === 1;
  }

  /** @param {number} i */
  set(i) {
    this.data[i >>> 5] |= 1 << (i & 31);
    this.version++;
  }

  /** @param {number} i */
  unset(i) {
    this.data[i >>> 5] &= ~(1 << (i & 31));
    this.version++;
  }

  /** Sets pixels x0..x1 (inclusive) on row y, clipped. @param {number} y @param {number} x0 @param {number} x1 */
  setSpan(y, x0, x1) {
    if (y < 0 || y >= this.height) return;
    if (x0 < 0) x0 = 0;
    if (x1 >= this.width) x1 = this.width - 1;
    if (x1 < x0) return;
    let a = y * this.width + x0;
    const b = y * this.width + x1 + 1; // exclusive
    const d = this.data;
    while (a < b && (a & 31) !== 0) { d[a >>> 5] |= 1 << (a & 31); a++; }
    while (a + 32 <= b) { d[a >>> 5] = 0xffffffff; a += 32; }
    while (a < b) { d[a >>> 5] |= 1 << (a & 31); a++; }
    this.version++;
  }

  /** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 inclusive corners, any order */
  fillRect(x0, y0, x1, y1) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const ay = Math.max(0, Math.min(y0, y1)), by = Math.min(this.height - 1, Math.max(y0, y1));
    for (let y = ay; y <= by; y++) this.setSpan(y, ax, bx);
  }

  // ------------------------------------------------------------ whole mask

  clear() {
    this.data.fill(0, 0, this.wordCount);
    this.version++;
    return this;
  }

  fill() {
    this.data.fill(0xffffffff, 0, this.wordCount);
    this.clearTail();
    this.version++;
    return this;
  }

  invert() {
    const d = this.data;
    for (let j = 0; j < this.wordCount; j++) d[j] = ~d[j];
    this.clearTail();
    this.version++;
    return this;
  }

  /** Zeroes the bits past `size`, which word operations may have set. */
  clearTail() {
    const idx = this.size >>> 5, rem = this.size & 31, d = this.data;
    if (idx < this.wordCount) {
      d[idx] &= rem ? ((1 << rem) - 1) >>> 0 : 0;
      for (let j = idx + 1; j < this.wordCount; j++) d[j] = 0;
    }
  }

  isEmpty() {
    const d = this.data;
    for (let j = 0; j < this.wordCount; j++) if (d[j] !== 0) return false;
    return true;
  }

  count() {
    let n = 0;
    const d = this.data;
    for (let j = 0; j < this.wordCount; j++) if (d[j]) n += popcount(d[j]);
    return n;
  }

  /** @param {Mask} m */
  sameShape(m) {
    return m.width === this.width && m.height === this.height;
  }

  /** @param {Mask} m */
  copyFrom(m) {
    if (!this.sameShape(m)) throw new Error('Mask size mismatch');
    this.data.set(m.data.subarray(0, this.wordCount));
    this.version++;
    return this;
  }

  clone() {
    return new Mask(this.width, this.height, this.data.slice());
  }

  /** @param {Mask} m */
  equals(m) {
    if (!this.sameShape(m)) return false;
    for (let j = 0; j < this.wordCount; j++) if (this.data[j] !== m.data[j]) return false;
    return true;
  }

  /**
   * Combines another mask into this one.
   * @param {Mask} m @param {'replace'|'add'|'remove'|'intersect'} mode
   */
  combine(m, mode) {
    if (!this.sameShape(m)) throw new Error('Mask size mismatch');
    const a = this.data, b = m.data, n = this.wordCount;
    if (mode === 'replace') a.set(b.subarray(0, n));
    else if (mode === 'add') for (let j = 0; j < n; j++) a[j] |= b[j];
    else if (mode === 'remove') for (let j = 0; j < n; j++) a[j] &= ~b[j];
    else if (mode === 'intersect') for (let j = 0; j < n; j++) a[j] &= b[j];
    else throw new Error(`Unknown select mode: ${mode}`);
    this.version++;
    return this;
  }

  // ------------------------------------------------------------ iteration

  /** Calls fn(i) for every set bit, in increasing index order. @param {(i: number) => void} fn */
  forEach(fn) {
    const d = this.data;
    for (let j = 0; j < this.wordCount; j++) {
      let v = d[j];
      while (v) {
        const t = v & -v;
        fn((j << 5) + (31 - Math.clz32(t)));
        v ^= t;
      }
    }
  }

  /** @returns {Uint32Array} indices of set bits, ascending */
  toIndices() {
    const out = new Uint32Array(this.count());
    let k = 0;
    this.forEach((i) => { out[k++] = i; });
    return out;
  }

  /** @returns {{x0: number, y0: number, x1: number, y1: number} | null} inclusive bounds */
  bounds() {
    const d = this.data, w = this.width;
    let first = -1, last = -1;
    for (let j = 0; j < this.wordCount; j++) if (d[j]) { first = j; break; }
    if (first < 0) return null;
    for (let j = this.wordCount - 1; j >= 0; j--) if (d[j]) { last = j; break; }
    const lo = (first << 5) + (31 - Math.clz32(d[first] & -d[first]));
    const hi = (last << 5) + (31 - Math.clz32(d[last]));
    const y0 = Math.floor(lo / w), y1 = Math.floor(hi / w);
    let x0 = w, x1 = -1;
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = 0; x < x0; x++) if (this.get(row + x)) { x0 = x; break; }
      for (let x = w - 1; x > x1; x--) if (this.get(row + x)) { x1 = x; break; }
    }
    return { x0, y0, x1, y1 };
  }

  // ------------------------------------------------------------ morphology

  /** Column masks for this size, cached. */
  geometry() {
    const key = `${this.width}x${this.height}`;
    let g = GEOMETRY.get(key);
    if (!g) {
      const col0 = new Mask(this.width, this.height), colLast = new Mask(this.width, this.height);
      const interior = new Mask(this.width, this.height);
      for (let y = 0; y < this.height; y++) {
        col0.set(y * this.width);
        colLast.set(y * this.width + this.width - 1);
        if (y > 0 && y < this.height - 1) interior.setSpan(y, 1, this.width - 2);
      }
      g = { col0: col0.data, colLast: colLast.data, interior: interior.data };
      if (GEOMETRY.size > 32) GEOMETRY.clear();
      GEOMETRY.set(key, g);
    }
    return g;
  }

  /**
   * Dilation by n pixels.
   * @param {number} [n] @param {4|8} [connectivity]
   */
  grow(n = 1, connectivity = 4) {
    for (let k = 0; k < n; k++) dilateInto(this, this.data, connectivity);
    this.version++;
    return this;
  }

  /**
   * Erosion by n pixels. With edgeIsOutside the canvas border counts as
   * unselected, so selected pixels touching it are removed (pixa.pics rule).
   * @param {number} [n] @param {4|8} [connectivity] @param {boolean} [edgeIsOutside]
   */
  shrink(n = 1, connectivity = 4, edgeIsOutside = true) {
    const g = this.geometry(), d = this.data, w = this.wordCount;
    for (let k = 0; k < n; k++) {
      const inv = new Uint32Array(d.length);
      for (let j = 0; j < w; j++) inv[j] = ~d[j];
      const tmp = new Mask(this.width, this.height, inv);
      tmp.clearTail();
      dilateInto(tmp, tmp.data, connectivity);
      for (let j = 0; j < w; j++) {
        d[j] &= ~inv[j];
        if (edgeIsOutside) d[j] &= g.interior[j];
      }
    }
    this.version++;
    return this;
  }

  /**
   * The selection's inner edge, `width` pixels thick: pixels of the mask
   * that are not in its erosion.
   * @param {number} [width] @param {4|8} [connectivity]
   */
  innerBorder(width = 1, connectivity = 4) {
    const inner = this.clone().shrink(width, connectivity, true);
    const out = this.clone();
    for (let j = 0; j < this.wordCount; j++) out.data[j] &= ~inner.data[j];
    out.version++;
    return out;
  }

  // ------------------------------------------------------------ outline

  /**
   * Boundary edges for marching ants, merged into runs.
   * horizontal: [y, x0, x1, ...] edge along row boundary y from x0 to x1 (edge coords);
   * vertical:   [x, y0, y1, ...] edge along column boundary x.
   */
  outline() {
    const b = this.bounds();
    if (!b) return { horizontal: new Int32Array(0), vertical: new Int32Array(0) };
    const w = this.width, nw = (w + 32) >>> 5; // row words, with room for the bit past the right edge
    /** @type {number[]} */ const h = [];
    /** @type {number[][]} */ const cols = Array.from({ length: w + 1 }, () => []);
    let prev = new Uint32Array(nw), cur = new Uint32Array(nw), vPrev = new Uint32Array(nw), vCur = new Uint32Array(nw);
    const open = new Int32Array(w + 1);
    if (b.y0 > 0) this.rowBits(b.y0 - 1, prev);
    for (let y = b.y0; y <= b.y1 + 1; y++) {
      if (y < this.height) this.rowBits(y, cur); else cur.fill(0);
      // Horizontal edges on boundary y: runs of columns where rows y and y - 1 differ,
      // found from the bits where that difference itself changes.
      let hc = 0, run = -1;
      for (let k = 0; k < nw; k++) {
        const x = (cur[k] ^ prev[k]) >>> 0;
        let t = (x ^ ((x << 1) | hc)) >>> 0;
        hc = x >>> 31;
        while (t) {
          const px = (k << 5) + 31 - Math.clz32(t & -t);
          if (run < 0) run = px; else { h.push(y, run, px); run = -1; }
          t &= t - 1;
        }
      }
      // Vertical edges in row y: where a pixel differs from its left neighbour (x = 0 .. w).
      let carry = 0;
      for (let k = 0; k < nw; k++) {
        const word = cur[k];
        vCur[k] = word ^ ((word << 1) | carry);
        carry = word >>> 31;
      }
      // Runs along y: a bit that appears opens a run, one that disappears closes it.
      for (let k = 0; k < nw; k++) {
        let ends = (vPrev[k] & ~vCur[k]) >>> 0, starts = (vCur[k] & ~vPrev[k]) >>> 0;
        while (ends) {
          const x = (k << 5) + 31 - Math.clz32(ends & -ends);
          cols[x].push(open[x], y);
          ends &= ends - 1;
        }
        while (starts) {
          open[(k << 5) + 31 - Math.clz32(starts & -starts)] = y;
          starts &= starts - 1;
        }
      }
      const t = prev; prev = cur; cur = t;
      const u = vPrev; vPrev = vCur; vCur = u;
    }
    // Vertical runs by column, then row.
    let total = 0;
    for (let x = 0; x <= w; x++) total += cols[x].length;
    const vertical = new Int32Array((total / 2) * 3);
    for (let x = 0, j = 0; x <= w; x++) {
      const c = cols[x];
      for (let k = 0; k < c.length; k += 2) { vertical[j++] = x; vertical[j++] = c[k]; vertical[j++] = c[k + 1]; }
    }
    return { horizontal: Int32Array.from(h), vertical };
  }

  /**
   * Row y as aligned words (bit x of the row at word x >> 5, bit x & 31);
   * bits past the width are zero.
   * @param {number} y @param {Uint32Array} out at least (width + 32) >>> 5 words
   */
  rowBits(y, out) {
    const w = this.width, d = this.data, start = y * w, words = (w + 31) >>> 5;
    const sh = start & 31, base = start >>> 5;
    for (let k = 0; k < words; k++) {
      const lo = d[base + k] >>> sh;
      out[k] = sh ? (lo | (d[base + k + 1] << (32 - sh))) >>> 0 : lo;
    }
    for (let k = words; k < out.length; k++) out[k] = 0;
    const rem = w & 31;
    if (rem) out[words - 1] &= (1 << rem) - 1;
    return out;
  }

  // ------------------------------------------------------------ serialisation

  /** Run lengths of alternating unset/set bits, starting with unset. */
  toRuns() {
    /** @type {number[]} */ const runs = [];
    const d = this.data, size = this.size, words = (size + 31) >>> 5;
    let last = 0, carry = 0;
    for (let k = 0; k < words; k++) {
      const x = d[k] >>> 0;
      if ((x === 0 && carry === 0) || (x === 0xffffffff && carry === 1)) continue; // no change inside this word
      // Bits where the value changes from the previous bit; each one ends a run.
      let t = (x ^ ((x << 1) | carry)) >>> 0;
      carry = x >>> 31;
      if (k === words - 1 && (size & 31)) t &= (1 << (size & 31)) - 1;
      while (t) {
        const p = (k << 5) + 31 - Math.clz32(t & -t);
        runs.push(p - last);
        last = p;
        t &= t - 1;
      }
    }
    runs.push(size - last);
    return Uint32Array.from(runs);
  }

  /** @param {Uint32Array} runs */
  setRuns(runs) {
    const d = this.data;
    d.fill(0, 0, this.wordCount);
    let i = 0;
    for (let k = 0; k < runs.length; k++) {
      const len = runs[k];
      if (k & 1) {
        let a = i;
        const b = Math.min(this.size, i + len);
        while (a < b && (a & 31) !== 0) { d[a >>> 5] |= 1 << (a & 31); a++; }
        while (a + 32 <= b) { d[a >>> 5] = 0xffffffff; a += 32; }
        while (a < b) { d[a >>> 5] |= 1 << (a & 31); a++; }
      }
      i += len;
    }
    this.version++;
    return this;
  }

  /** @param {number} width @param {number} height @param {Uint32Array} runs */
  static fromRuns(width, height, runs) {
    return new Mask(width, height).setRuns(runs);
  }

  /**
   * Zero-copy view as a SetFixed (pass the class: `import { SetFixed } from
   * '@asaitama/boolean-array'`). Both objects then share one buffer.
   *
   * boolean-array 6.0.1 miscounts `size` after `import()` (its countOnes reads
   * the first word only and never resets its total), and `indexes` is sized
   * from `size`, so the true count is written back. If that private field is
   * missing in another version, the set is rebuilt member by member instead.
   * @param {{ import(data: Uint32Array): any, new(n: number): any }} SetFixed
   */
  toSetFixed(SetFixed) {
    const sf = SetFixed.import(this.data);
    const n = this.count();
    if (sf.size === n) return sf;
    if (sf._VA_ instanceof Uint32Array && sf._VA_.length > 0) {
      sf._VA_[0] = n;
      if (sf.size === n) return sf;
    }
    const built = new SetFixed(this.size);
    this.forEach((i) => built.add(i));
    return built;
  }

  /**
   * @param {{ bitArrayDataCopy: Uint32Array }} setFixed
   * @param {number} width @param {number} height
   */
  static fromSetFixed(setFixed, width, height) {
    const m = new Mask(width, height);
    const src = setFixed.bitArrayDataCopy;
    m.data.set(src.subarray(0, Math.min(src.length - 1, m.wordCount)));
    m.clearTail();
    return m;
  }
}

/**
 * In-place dilation of `data` (a mask's words) by one pixel.
 * @param {Mask} m @param {Uint32Array} data @param {4|8} connectivity
 */
function dilateInto(m, data, connectivity) {
  const n = m.wordCount, g = m.geometry(), w = m.width;
  const src = data.slice(0, n);
  // Horizontal: neighbours at x - 1 and x + 1, never wrapping across rows.
  const horiz = new Uint32Array(n);
  for (let j = 0; j < n; j++) {
    const left = (src[j] << 1) | (j > 0 ? src[j - 1] >>> 31 : 0); // content moves to x + 1
    const right = (src[j] >>> 1) | (j + 1 < n ? src[j + 1] << 31 : 0); // content moves to x - 1
    horiz[j] = src[j] | (left & ~g.col0[j]) | (right & ~g.colLast[j]);
  }
  // The last pixel can spill one bit past `size`; drop it before shifting rows.
  const tailWord = m.size >>> 5, rem = m.size & 31;
  if (tailWord < n) {
    horiz[tailWord] &= rem ? ((1 << rem) - 1) >>> 0 : 0;
    for (let j = tailWord + 1; j < n; j++) horiz[j] = 0;
  }
  const base = connectivity === 8 ? horiz : src;
  const ws = w >>> 5, bs = w & 31;
  for (let j = 0; j < n; j++) {
    // content moves down one row: out bit i = base bit i - w
    let down = 0;
    const a = j - ws;
    if (a >= 0) down = bs ? (base[a] << bs) | (a - 1 >= 0 ? base[a - 1] >>> (32 - bs) : 0) : base[a];
    // content moves up one row: out bit i = base bit i + w
    let up = 0;
    const c = j + ws;
    if (c < n) up = bs ? (base[c] >>> bs) | (c + 1 < n ? base[c + 1] << (32 - bs) : 0) : base[c];
    data[j] = horiz[j] | down | up;
  }
  m.clearTail();
}
