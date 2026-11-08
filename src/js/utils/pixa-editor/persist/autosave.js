// @ts-check
/**
 * Auto backup to IndexedDB, without PouchDB.
 *
 * Stores: `docs` (one record per document: name, size, thumbnail, head and
 * clean-head counters) and `snapshots` (.pixa bytes keyed by [docId, n]).
 * Each save writes snapshot n + 1 and moves the head in the same
 * transaction, then drops all but the last `keep` snapshots, so a crash in
 * the middle of a save leaves the previous head intact.
 *
 * Timing: 2 s after the last commit, at most every 10 s during continuous
 * work, and at once when the page is hidden or unloaded.
 */
import { serializeProject, parseProject } from '../io/project.js';
import { encodePNG } from '../io/png.js';
import { compositeAll } from '../render/composite.js';

const DB_VERSION = 1;

/** @param {IDBRequest} req @returns {Promise<any>} */
const done = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
/** @param {IDBTransaction} tx @returns {Promise<void>} */
const finished = (tx) => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Transaction aborted')); });

/**
 * @param {string} [name] database name
 * @param {IDBFactory} [idb]
 */
export async function openStore(name = 'pixa-editor', idb = globalThis.indexedDB) {
  if (!idb) throw new Error('IndexedDB is not available');
  const db = await new Promise((resolve, reject) => {
    const req = idb.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs', { keyPath: 'docId' });
      if (!d.objectStoreNames.contains('snapshots')) d.createObjectStore('snapshots', { keyPath: ['docId', 'n'] });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });
  return new SnapshotStore(db);
}

export class SnapshotStore {
  /** @param {IDBDatabase} db */
  constructor(db) {
    this.db = db;
  }

  /**
   * Writes snapshot n + 1 and moves the head, in one transaction.
   * @param {string} docId @param {Uint8Array} bytes @param {object} meta @param {number} [keep]
   * @returns {Promise<number>} the new head
   */
  async put(docId, bytes, meta = {}, keep = 5) {
    const tx = this.db.transaction(['docs', 'snapshots'], 'readwrite');
    const docs = tx.objectStore('docs'), snaps = tx.objectStore('snapshots');
    const rec = (await done(docs.get(docId))) || { docId, head: 0, cleanHead: 0, created: Date.now() };
    const n = rec.head + 1, savedAt = Date.now();
    snaps.put({ docId, n, bytes, savedAt });
    docs.put({ ...rec, ...meta, docId, head: n, savedAt });
    if (n - keep >= 1) snaps.delete(IDBKeyRange.bound([docId, 0], [docId, n - keep]));
    await finished(tx);
    return n;
  }

  /** @param {string} docId @param {number} [n] defaults to the head */
  async get(docId, n) {
    const tx = this.db.transaction(['docs', 'snapshots'], 'readonly');
    const rec = await done(tx.objectStore('docs').get(docId));
    if (!rec) return null;
    const snap = await done(tx.objectStore('snapshots').get([docId, n ?? rec.head]));
    return snap ? { meta: rec, bytes: /** @type {Uint8Array} */ (snap.bytes), n: snap.n, savedAt: snap.savedAt } : null;
  }

  /** All documents, newest first, without snapshot bytes. */
  async list() {
    const tx = this.db.transaction('docs', 'readonly');
    const all = await done(tx.objectStore('docs').getAll());
    return all.sort((a, b) => b.savedAt - a.savedAt);
  }

  /** Snapshot numbers kept for a document. @param {string} docId */
  async versions(docId) {
    const tx = this.db.transaction('snapshots', 'readonly');
    const keys = await done(tx.objectStore('snapshots').getAllKeys(IDBKeyRange.bound([docId, 0], [docId, Infinity])));
    return keys.map((k) => k[1]);
  }

  /** The current head counts as saved by the user. @param {string} docId */
  async markClean(docId) {
    const tx = this.db.transaction('docs', 'readwrite'), docs = tx.objectStore('docs');
    const rec = await done(docs.get(docId));
    if (rec) docs.put({ ...rec, cleanHead: rec.head });
    await finished(tx);
  }

  /** @param {string} docId */
  async remove(docId) {
    const tx = this.db.transaction(['docs', 'snapshots'], 'readwrite');
    tx.objectStore('docs').delete(docId);
    tx.objectStore('snapshots').delete(IDBKeyRange.bound([docId, 0], [docId, Infinity]));
    await finished(tx);
  }

  close() { this.db.close(); }
}

/**
 * @typedef {{ docId?: string, store?: SnapshotStore | Promise<SnapshotStore>, dbName?: string,
 *   debounceMs?: number, maxIntervalMs?: number, keep?: number, thumbnailSize?: number,
 *   target?: any }} AutosaveOptions
 */

export class Autosave {
  /** @param {import('../core/Editor.js').Editor} editor @param {AutosaveOptions} [o] */
  constructor(editor, o = {}) {
    this.editor = editor;
    this.fixedId = o.docId ?? null;
    this.debounceMs = o.debounceMs ?? 2000;
    this.maxIntervalMs = o.maxIntervalMs ?? 10000;
    this.keep = o.keep ?? 5;
    this.thumbnailSize = o.thumbnailSize ?? 64;
    this.store = Promise.resolve(o.store || openStore(o.dbName));
    this.store.catch(() => {});
    this.target = o.target ?? (typeof window !== 'undefined' ? window : null);
    /** @type {any} */ this.timer = null;
    this.firstDirtyAt = 0;
    this.dirty = false;
    /** @type {Promise<any> | null} */ this.saving = null;
    this.lastHead = 0;
    /** @type {Array<() => void>} */ this.off = [];
    this.disposed = false;
  }

  get docId() { return this.fixedId ?? this.editor.doc.id; }

  start() {
    const ed = this.editor;
    if (this.target) {
      requestPersistence().then((r) => {
        ed.events.emit('storage', r);
        if (r.nearlyFull) ed.events.emit('status', { message: `Browser storage is ${Math.round((100 * r.usage) / r.quota)}% full: backups may fail. Export your work.` });
      }, () => {});
    }
    this.off.push(ed.events.on('change', (e) => { if (e.reason === 'commit' || e.reason === 'undo' || e.reason === 'redo') this.schedule(); }));
    this.off.push(ed.events.on('document', (e) => { if (e.replaced) this.schedule(); }));
    const t = this.target;
    if (t && t.addEventListener) {
      const hidden = () => { if (typeof document === 'undefined' || document.visibilityState === 'hidden') this.flush(); };
      const leave = () => this.flush();
      const doc = typeof document !== 'undefined' ? document : null;
      doc?.addEventListener('visibilitychange', hidden);
      t.addEventListener('pagehide', leave);
      this.off.push(() => { doc?.removeEventListener('visibilitychange', hidden); t.removeEventListener('pagehide', leave); });
    }
    return this;
  }

  schedule() {
    if (this.disposed) return;
    this.dirty = true;
    const now = Date.now();
    if (!this.firstDirtyAt) this.firstDirtyAt = now;
    clearTimeout(this.timer);
    const wait = Math.max(0, Math.min(this.debounceMs, this.firstDirtyAt + this.maxIntervalMs - now));
    this.timer = setTimeout(() => { this.flush(); }, wait);
  }

  /** Saves now if anything changed since the last save. */
  async flush() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.saving) {
      await this.saving;
      if (!this.dirty) return this.lastHead;
    }
    if (!this.dirty) return this.lastHead;
    this.dirty = false;
    this.firstDirtyAt = 0;
    const ed = this.editor, doc = ed.doc, docId = this.docId;
    // serializeProject captures the document synchronously; the thumbnail pixels are taken now too.
    const thumbPixels = this.thumbnailPixels(doc);
    const meta = { name: doc.name, width: doc.width, height: doc.height, layers: doc.layers.length };
    const project = serializeProject(doc, { colors: { ...ed.colors } });
    const work = (async () => {
      const store = await this.store;
      const bytes = await project;
      const thumbnail = await encodePNG(thumbPixels.rgba, thumbPixels.width, thumbPixels.height);
      const head = await store.put(docId, bytes, { ...meta, thumbnail, bytes: bytes.length }, this.keep);
      this.lastHead = head;
      ed.events.emit('autosave', { docId, head, bytes: bytes.length });
      return head;
    })();
    this.saving = work;
    try {
      return await work;
    } catch (error) {
      this.dirty = true;
      ed.events.emit('error', { source: 'autosave', error });
      return this.lastHead;
    } finally {
      if (this.saving === work) this.saving = null;
    }
  }

  /** Small preview pixels, nearest neighbour. @param {any} doc */
  thumbnailPixels(doc) {
    const s = Math.min(1, this.thumbnailSize / Math.max(doc.width, doc.height));
    const tw = Math.max(1, Math.round(doc.width * s)), th = Math.max(1, Math.round(doc.height * s));
    const full = compositeAll(doc), small = new Uint32Array(tw * th);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) small[y * tw + x] = full[Math.min(doc.height - 1, Math.floor(y / s)) * doc.width + Math.min(doc.width - 1, Math.floor(x / s))];
    return { rgba: small, width: tw, height: th };
  }

  /** Documents whose latest snapshot was never marked as saved by the user. */
  async listRecoverable() {
    const store = await this.store;
    return (await store.list()).filter((d) => d.head > d.cleanHead).map(({ docId, name, width, height, layers, savedAt, head, thumbnail }) => ({ docId, name, width, height, layers, savedAt, head, thumbnail }));
  }

  /** @param {string} docId @param {number} [n] */
  async load(docId, n) {
    const store = await this.store;
    const snap = await store.get(docId, n);
    if (!snap) return null;
    return { ...(await parseProject(snap.bytes)), n: snap.n, savedAt: snap.savedAt };
  }

  /** Opens a recovered snapshot in the editor. @param {string} docId @param {number} [n] */
  async recover(docId, n) {
    const r = await this.load(docId, n);
    if (!r) return false;
    this.editor.setDocument(r.doc);
    if (r.colors) this.editor.setColors(r.colors);
    return true;
  }

  async markClean() {
    await this.flush();
    await (await this.store).markClean(this.docId);
  }

  /** The editor was saved by the user (export, project save): stop offering this state for recovery. */
  async saved() {
    this.editor.markSaved();
    await this.markClean();
  }

  /** @param {string} docId */
  async discard(docId) {
    await (await this.store).remove(docId);
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    for (const f of this.off) f();
    this.off = [];
  }
}

/** Asks the browser to keep this site's storage, and reports usage. */
export async function requestPersistence() {
  const s = typeof navigator !== 'undefined' ? navigator.storage : null;
  if (!s) return { persisted: false, usage: 0, quota: 0, nearlyFull: false };
  const persisted = s.persist ? await s.persist().catch(() => false) : false;
  const est = s.estimate ? await s.estimate().catch(() => ({ usage: 0, quota: 0 })) : { usage: 0, quota: 0 };
  const usage = est.usage || 0, quota = est.quota || 0;
  return { persisted, usage, quota, nearlyFull: quota > 0 && usage / quota > 0.8 };
}
