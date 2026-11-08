// @ts-check
/** Minimal synchronous event emitter. Listener errors are reported, never thrown into the core. */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /** @param {string} type @param {(payload: any) => void} fn @returns {() => void} unsubscribe */
  on(type, fn) {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn);
    return () => this.off(type, fn);
  }

  /** @param {string} type @param {Function} fn */
  off(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }

  /** @param {string} type @param {any} [payload] */
  emit(type, payload) {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        if (type !== 'error') this.emit('error', { source: type, error: err });
        else console.error(err);
      }
    }
  }
}
