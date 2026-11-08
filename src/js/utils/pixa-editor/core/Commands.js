// @ts-check
/**
 * @typedef {import('./Editor.js').Editor} Editor
 * @typedef {{ id: string, readonly args: any, pending?: boolean, update(next: object): void, commit(): any, cancel(): void }} PreviewSession
 * @typedef {Object} CommandDef
 * @property {string} id
 * @property {string} [label]
 * @property {string} [icon]
 * @property {(editor: Editor, args: any) => boolean} [isEnabled]
 * @property {(editor: Editor, args: any) => any} run
 * @property {(editor: Editor, args: any) => PreviewSession} [preview]
 */

/** Registry: every user-facing action, from any surface, goes through here. */
export class Commands {
  /** @param {Editor} editor */
  constructor(editor) {
    this.editor = editor;
    /** @type {Map<string, CommandDef>} */
    this.map = new Map();
  }

  /** @param {CommandDef} def */
  register(def) {
    if (!def || !def.id || typeof def.run !== 'function') throw new Error('A command needs an id and run()');
    this.map.set(def.id, def);
    return this;
  }

  /** @param {string} id */
  get(id) {
    return this.map.get(id);
  }

  /** @param {string} id @param {any} [args] */
  can(id, args) {
    const def = this.map.get(id);
    if (!def) return false;
    if (!def.isEnabled) return true;
    try {
      return !!def.isEnabled(this.editor, args || {});
    } catch {
      return false;
    }
  }

  /** @param {string} id @param {any} [args] */
  run(id, args) {
    const def = this.map.get(id);
    if (!def) throw new Error(`Unknown command: ${id}`);
    if (!this.can(id, args)) return false;
    const result = def.run(this.editor, args || {});
    this.editor.events.emit('command', { id, args: args || {} });
    return result === undefined ? true : result;
  }

  /** @param {string} id @param {any} [args] */
  preview(id, args) {
    const def = this.map.get(id);
    if (!def || !def.preview) throw new Error(`Command has no preview: ${id}`);
    if (!this.can(id, args)) return null;
    return def.preview(this.editor, args || {});
  }

  list() {
    return [...this.map.values()].map((d) => ({ id: d.id, label: d.label || d.id }));
  }
}
