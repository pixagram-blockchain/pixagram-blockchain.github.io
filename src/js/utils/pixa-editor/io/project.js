// @ts-check
/**
 * The .pixa project format, version 1.
 *
 *   "PIXA"  u8 version  u32le manifest length  manifest (UTF-8 JSON)
 *   then chunks: 4-byte type, u32le length, payload
 *     "PAL " one per layer: palette colours, u32le each (index 0 transparent)
 *     "IDX " one per layer: indices (u8 when the palette fits, else u16le), deflate-raw
 *     "SEL " selection runs (u32le), deflate-raw — when something is selected
 *     "FLT " floating pixels (u32le packed colours), deflate-raw
 *     "FSR " the floating layer's untransformed source, when it differs
 *     "REF " reference image, its original encoded bytes
 *     "END "
 *
 * Layers are written compacted (only used colours), without touching the
 * live document. Unknown chunks are skipped, so later versions can add some.
 */
import { compress, decompress, ByteWriter, wordsToBytes, bytesToWords } from './bytes.js';
import { Document } from '../model/Document.js';
import { Layer } from '../model/Layer.js';
import { Palette } from '../model/Palette.js';
import { Mask } from '../model/Mask.js';
import { Floating } from '../model/Floating.js';
import { makeReference } from '../model/Reference.js';

export const PROJECT_VERSION = 1;
const MAGIC = 'PIXA';
const utf8 = new TextEncoder(), utf8d = new TextDecoder();

/** Used colours only, remapped, without modifying the layer. @param {Layer} layer */
function compactCopy(layer) {
  const used = new Uint8Array(layer.palette.length), idx = layer.indices;
  for (let i = 0; i < idx.length; i++) used[idx[i]] = 1;
  const colors = [0], remap = new Uint16Array(layer.palette.length), seen = new Map([[0, 0]]);
  for (let i = 1; i < used.length; i++) {
    if (!used[i]) continue;
    const c = layer.palette.colors[i];
    let k = seen.get(c);
    if (k === undefined) { seen.set(c, (k = colors.length)); colors.push(c); }
    remap[i] = k;
  }
  const wide = colors.length > 256;
  const out = wide ? new Uint16Array(idx.length) : new Uint8Array(idx.length);
  for (let i = 0; i < idx.length; i++) out[i] = remap[idx[i]];
  return { colors: Uint32Array.from(colors), indices: out, wide };
}

/** @param {ByteWriter} w @param {string} type @param {Uint8Array} data */
function chunk(w, type, data) {
  w.ascii(type);
  w.u32le(data.length);
  w.bytes(data);
}

/** @param {Uint16Array} a */
function u16Bytes(a) {
  const out = new Uint8Array(a.length * 2), dv = new DataView(out.buffer);
  for (let i = 0; i < a.length; i++) dv.setUint16(i * 2, a[i], true);
  return out;
}

/**
 * @param {Document} doc
 * @param {{ colors?: { primary: number, secondary: number }, meta?: object }} [extras]
 * @returns {Promise<Uint8Array>}
 */
export async function serializeProject(doc, extras = {}) {
  // Everything is captured before the first await, so edits made while the
  // compression runs cannot mix two states into one file.
  const copies = doc.layers.map(compactCopy);
  const f = doc.floating, ref = doc.reference;
  const selectionRuns = doc.selection.isEmpty() ? null : doc.selection.toRuns();
  const manifest = {
    format: 'pixa', version: PROJECT_VERSION, id: doc.id, name: doc.name,
    width: doc.width, height: doc.height, activeLayerId: doc.activeLayerId, tileSize: 32,
    layers: doc.layers.map((l, i) => ({
      id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, locked: l.locked,
      paletteSize: copies[i].colors.length, indexBytes: copies[i].wide ? 2 : 1,
    })),
    selection: !doc.selection.isEmpty(),
    floating: f ? { x: f.x, y: f.y, width: f.width, height: f.height, dw: f.dw, dh: f.dh, mode: f.mode, sourceLayerId: f.sourceLayerId, origin: f.origin, source: f.source ? { width: f.source.width, height: f.source.height, same: f.source.rgba === f.rgba } : null } : null,
    reference: ref ? { mime: ref.mime, width: ref.width, height: ref.height, x: ref.x, y: ref.y, dw: ref.dw, dh: ref.dh, rotation: ref.rotation, opacity: ref.opacity, visible: ref.visible, above: ref.above } : null,
    colors: extras.colors ? { primary: extras.colors.primary >>> 0, secondary: extras.colors.secondary >>> 0 } : null,
    meta: extras.meta || null,
    savedAt: Date.now(),
  };
  const json = utf8.encode(JSON.stringify(manifest));
  const w = new ByteWriter(1024 + doc.width * doc.height);
  w.ascii(MAGIC);
  w.u8(PROJECT_VERSION);
  w.u32le(json.length);
  w.bytes(json);
  for (const c of copies) {
    chunk(w, 'PAL ', wordsToBytes(c.colors));
    chunk(w, 'IDX ', await compress(c.wide ? u16Bytes(/** @type {Uint16Array} */ (c.indices)) : /** @type {Uint8Array} */ (c.indices), 'deflate-raw'));
  }
  if (selectionRuns) chunk(w, 'SEL ', await compress(wordsToBytes(selectionRuns), 'deflate-raw'));
  if (f) {
    chunk(w, 'FLT ', await compress(wordsToBytes(f.rgba), 'deflate-raw'));
    if (f.source && f.source.rgba !== f.rgba) chunk(w, 'FSR ', await compress(wordsToBytes(f.source.rgba), 'deflate-raw'));
  }
  if (ref) chunk(w, 'REF ', ref.bytes);
  chunk(w, 'END ', new Uint8Array(0));
  return w.result();
}

/** @param {Uint8Array} bytes */
export function isProject(bytes) {
  return bytes.length > 9 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === MAGIC;
}

/**
 * @param {Uint8Array | ArrayBuffer} input
 * @returns {Promise<{ doc: Document, manifest: any, colors: { primary: number, secondary: number } | null }>}
 */
export async function parseProject(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!isProject(bytes)) throw new Error('Not a .pixa project');
  const version = bytes[4];
  if (version > PROJECT_VERSION) throw new Error(`.pixa version ${version} is newer than this editor (${PROJECT_VERSION})`);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = dv.getUint32(5, true);
  const manifest = migrate(JSON.parse(utf8d.decode(bytes.subarray(9, 9 + len))));
  /** @type {Array<[string, Uint8Array]>} */
  const chunks = [];
  for (let p = 9 + len; p + 8 <= bytes.length; ) {
    const type = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]), n = dv.getUint32(p + 4, true);
    if (type === 'END ') break;
    chunks.push([type, bytes.subarray(p + 8, p + 8 + n)]);
    p += 8 + n;
  }
  const W = manifest.width, H = manifest.height, layers = [];
  const pals = chunks.filter((c) => c[0] === 'PAL '), idxs = chunks.filter((c) => c[0] === 'IDX ');
  for (let i = 0; i < manifest.layers.length; i++) {
    const m = manifest.layers[i];
    const colors = bytesToWords(pals[i][1]);
    const raw = await decompress(idxs[i][1], 'deflate-raw');
    const indices = new Uint16Array(W * H);
    if (m.indexBytes === 2) {
      const d = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      for (let k = 0; k < indices.length; k++) indices[k] = d.getUint16(k * 2, true);
    } else indices.set(raw.subarray(0, indices.length));
    layers.push(new Layer({ id: m.id, name: m.name, width: W, height: H, palette: Palette.fromArray(colors), indices, visible: m.visible, opacity: m.opacity, locked: m.locked }));
  }
  const doc = new Document({ width: W, height: H, layers, id: manifest.id, name: manifest.name });
  if (manifest.activeLayerId && doc.layerById(manifest.activeLayerId)) doc.activeLayerId = manifest.activeLayerId;
  const sel = chunks.find((c) => c[0] === 'SEL ');
  if (sel) doc.selection = Mask.fromRuns(W, H, bytesToWords(await decompress(sel[1], 'deflate-raw')));
  const flt = chunks.find((c) => c[0] === 'FLT ');
  if (manifest.floating && flt) {
    const fm = manifest.floating, rgba = bytesToWords(await decompress(flt[1], 'deflate-raw'));
    const fsr = chunks.find((c) => c[0] === 'FSR ');
    let source = null;
    if (fm.source) source = { width: fm.source.width, height: fm.source.height, rgba: fm.source.same || !fsr ? rgba : bytesToWords(await decompress(fsr[1], 'deflate-raw')) };
    doc.floating = new Floating({ rgba, width: fm.width, height: fm.height, x: fm.x, y: fm.y, dw: fm.dw, dh: fm.dh, mode: fm.mode, sourceLayerId: fm.sourceLayerId, origin: fm.origin, source });
  }
  const refChunk = chunks.find((c) => c[0] === 'REF ');
  if (manifest.reference && refChunk) doc.reference = makeReference({ ...manifest.reference, bytes: refChunk[1].slice() });
  return { doc, manifest, colors: manifest.colors };
}

/** Versioned migrations; version 1 is the first, so nothing to do yet. @param {any} m */
function migrate(m) {
  if (m.format !== 'pixa') throw new Error('Not a .pixa manifest');
  return m;
}
