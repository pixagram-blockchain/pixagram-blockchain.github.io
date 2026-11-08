// @ts-check
/**
 * Linear undo stack of transactions. A new entry after an undo drops the
 * redo branch. Oldest entries are evicted past the memory budget.
 */
export class History {
  /** @param {{ budgetBytes?: number, maxEntries?: number }} [o] */
  constructor(o = {}) {
    this.budgetBytes = o.budgetBytes ?? 64 * 1024 * 1024;
    this.maxEntries = o.maxEntries ?? 500;
    /** @type {import('./patches.js').HistoryEntry[]} */
    this.stack = [];
    this.index = 0;
    this.bytes = 0;
    /** Id of the newest entry dropped from the front, standing for the state at index 0. */
    this.baseId = 0;
  }

  /** Identifies the current state: the last applied entry's id (0 = as opened). */
  stateId() {
    return this.index > 0 ? this.stack[this.index - 1].id : this.baseId;
  }

  /** @param {import('./patches.js').HistoryEntry} entry */
  push(entry) {
    for (let i = this.index; i < this.stack.length; i++) this.bytes -= this.stack[i].bytes;
    this.stack.length = this.index;
    this.stack.push(entry);
    this.index++;
    this.bytes += entry.bytes;
    while ((this.bytes > this.budgetBytes || this.stack.length > this.maxEntries) && this.stack.length > 1) {
      const dropped = /** @type {any} */ (this.stack.shift());
      this.bytes -= dropped.bytes;
      this.baseId = dropped.id;
      this.index--;
    }
  }

  /**
   * Reverts the newest entry and forgets it, when it is the current state:
   * the next transaction then stands for both (a slider drag as one step).
   * @param {import('../core/Editor.js').Editor} editor
   */
  retract(editor) {
    if (!this.index || this.index !== this.stack.length) return null;
    const e = /** @type {import('./patches.js').HistoryEntry} */ (this.undo(editor));
    this.stack.length = this.index;
    this.bytes -= e.bytes;
    return e;
  }

  canUndo() {
    return this.index > 0;
  }

  canRedo() {
    return this.index < this.stack.length;
  }

  /** @param {import('../core/Editor.js').Editor} editor */
  undo(editor) {
    if (!this.canUndo()) return null;
    const e = this.stack[--this.index];
    for (let i = e.patches.length - 1; i >= 0; i--) e.patches[i].apply(editor, 'before');
    return e;
  }

  /** @param {import('../core/Editor.js').Editor} editor */
  redo(editor) {
    if (!this.canRedo()) return null;
    const e = this.stack[this.index++];
    for (const p of e.patches) p.apply(editor, 'after');
    return e;
  }

  clear() {
    this.stack = [];
    this.index = 0;
    this.bytes = 0;
    this.baseId = 0;
  }

  /** Alias of list(), as in the API sketch. */
  entries() {
    return this.list();
  }

  list() {
    return this.stack.map((e, i) => ({ id: e.id, label: e.label, time: e.time, bytes: e.bytes, applied: i < this.index }));
  }
}
