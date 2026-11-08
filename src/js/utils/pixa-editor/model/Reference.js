// @ts-check
/**
 * Reference image: a picture shown with the art for tracing, never part of
 * it and never exported. Immutable like Floating, so history keeps
 * references. The core stores the encoded bytes and the placement; the view
 * decodes and draws it.
 *
 * Placement is in document pixels: (x, y) top-left, dw × dh on screen,
 * `rotation` quarter turns clockwise applied about the rectangle's centre
 * after scaling, so (x, y, dw, dh) always describe the visible rectangle.
 */

/**
 * @typedef {{ bytes: Uint8Array, mime: string, width: number, height: number,
 *   x: number, y: number, dw: number, dh: number, rotation: number,
 *   opacity: number, visible: boolean, above: boolean }} Reference
 */

/**
 * @param {Partial<Reference> & { bytes: Uint8Array, width: number, height: number }} o
 * @returns {Reference}
 */
export function makeReference(o) {
  const rotation = (((Math.round(o.rotation ?? 0)) % 4) + 4) % 4;
  return Object.freeze({
    bytes: o.bytes,
    mime: o.mime || 'image/png',
    width: Math.max(1, o.width | 0),
    height: Math.max(1, o.height | 0),
    x: o.x ?? 0,
    y: o.y ?? 0,
    dw: Math.max(1, o.dw ?? (rotation % 2 ? o.height : o.width)),
    dh: Math.max(1, o.dh ?? (rotation % 2 ? o.width : o.height)),
    rotation,
    opacity: Math.max(0, Math.min(1, o.opacity ?? 0.5)),
    visible: o.visible !== false,
    above: o.above !== false,
  });
}

/** @param {Reference} ref @param {Partial<Reference>} patch */
export function updateReference(ref, patch) {
  return makeReference({ ...ref, ...patch });
}

/** @param {Reference | null} ref @param {number} dx @param {number} dy */
export function moveReference(ref, dx, dy) {
  return ref ? makeReference({ ...ref, x: ref.x + dx, y: ref.y + dy }) : null;
}

/**
 * Follows a quarter turn of a W × H document.
 * @param {Reference | null} ref @param {1|-1} dir 1 = clockwise @param {number} W @param {number} H
 */
export function rotateReference(ref, dir, W, H) {
  if (!ref) return null;
  const x = dir === 1 ? H - (ref.y + ref.dh) : ref.y;
  const y = dir === 1 ? ref.x : W - (ref.x + ref.dw);
  return makeReference({ ...ref, x, y, dw: ref.dh, dh: ref.dw, rotation: ref.rotation + dir });
}
