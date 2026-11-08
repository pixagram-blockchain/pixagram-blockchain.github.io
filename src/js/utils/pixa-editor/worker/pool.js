// @ts-check
/**
 * A small worker pool with a main-thread fallback. Jobs are queued and
 * handed to the first idle worker; if a worker cannot start or crashes, the
 * pool stops using workers and runs the remaining jobs on the main thread,
 * so callers always get an answer.
 */
import { OPS } from './ops.js';

/**
 * @typedef {{ create?: () => Worker, size?: number, minPixels?: number }} WorkerOptions
 * `create` makes one worker running src/worker/entry.js; `minPixels` is the
 * document size from which pixel-effect previews go to the pool.
 */

export class WorkerPool {
  /** @param {WorkerOptions} [o] */
  constructor(o = {}) {
    this.create = o.create || null;
    this.size = Math.max(1, o.size ?? 1);
    /** @type {Array<{ worker: Worker, busy: boolean }>} */
    this.workers = [];
    /** @type {Array<{ id: number, op: string, args: any[], transfer: Transferable[], resolve: (v: any) => void, reject: (e: any) => void }>} */
    this.queue = [];
    /** @type {Map<number, { job: any, slot: any }>} */
    this.running = new Map();
    this.nextId = 1;
    this.broken = !this.create;
  }

  /** True when jobs really leave the main thread. */
  get threaded() { return !this.broken; }

  /**
   * @param {string} op one of OPS @param {any[]} args @param {Transferable[]} [transfer]
   * @returns {Promise<any>}
   */
  run(op, args, transfer = []) {
    if (!OPS[op]) return Promise.reject(new Error(`Unknown worker op: ${op}`));
    if (this.broken) return this.local(op, args);
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, op, args, transfer, resolve, reject });
      this.pump();
    });
  }

  /** @param {string} op @param {any[]} args */
  local(op, args) {
    try { return Promise.resolve(OPS[op](...args)); } catch (err) { return Promise.reject(err); }
  }

  pump() {
    while (this.queue.length) {
      let slot = this.workers.find((w) => !w.busy);
      if (!slot && this.workers.length < this.size) slot = this.spawn() || undefined;
      if (this.broken) { this.drainLocally(); return; }
      if (!slot) return;
      const job = /** @type {any} */ (this.queue.shift());
      slot.busy = true;
      this.running.set(job.id, { job, slot });
      try {
        slot.worker.postMessage({ id: job.id, op: job.op, args: job.args }, job.transfer);
      } catch {
        // The arguments could not be cloned: run this one here.
        this.running.delete(job.id);
        slot.busy = false;
        this.local(job.op, job.args).then(job.resolve, job.reject);
      }
    }
  }

  spawn() {
    let worker;
    try {
      worker = /** @type {() => Worker} */ (this.create)();
    } catch {
      this.broken = true;
      return null;
    }
    const slot = { worker, busy: false };
    worker.onmessage = (/** @type {MessageEvent} */ e) => {
      const { id, result, error } = e.data || {};
      const r = this.running.get(id);
      if (!r) return;
      this.running.delete(id);
      slot.busy = false;
      if (error) r.job.reject(new Error(error));
      else r.job.resolve(result);
      this.pump();
    };
    worker.onerror = (/** @type {ErrorEvent} */ e) => {
      e.preventDefault?.();
      this.fail();
    };
    this.workers.push(slot);
    return slot;
  }

  /** A worker died or never started: finish everything on the main thread. */
  fail() {
    this.broken = true;
    for (const { job } of this.running.values()) this.queue.unshift(job);
    this.running.clear();
    for (const s of this.workers) { try { s.worker.terminate(); } catch { /* already gone */ } }
    this.workers = [];
    this.drainLocally();
  }

  drainLocally() {
    const jobs = this.queue.splice(0);
    for (const job of jobs) this.local(job.op, job.args).then(job.resolve, job.reject);
  }

  terminate() {
    for (const s of this.workers) s.worker.terminate();
    this.workers = [];
    for (const { job } of this.running.values()) job.reject(new Error('Worker pool terminated'));
    this.running.clear();
    for (const job of this.queue.splice(0)) job.reject(new Error('Worker pool terminated'));
  }
}
