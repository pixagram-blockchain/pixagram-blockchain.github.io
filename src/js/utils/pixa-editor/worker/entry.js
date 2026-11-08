// @ts-check
/**
 * Worker entry. Bundle it on its own (module or classic worker) and pass a
 * factory to the editor:
 *
 *   createEditor({ workers: { create: () => new Worker(new URL('@pixa/editor/worker', import.meta.url), { type: 'module' }) } })
 */
import { OPS, transferables } from './ops.js';

/** @type {any} */
const scope = globalThis;
scope.onmessage = (/** @type {MessageEvent} */ e) => {
  const { id, op, args } = e.data || {};
  try {
    const fn = OPS[op];
    if (!fn) throw new Error(`Unknown worker op: ${op}`);
    const result = fn(...args);
    scope.postMessage({ id, result }, transferables(result));
  } catch (err) {
    scope.postMessage({ id, error: /** @type {any} */ (err)?.message || String(err) });
  }
};
