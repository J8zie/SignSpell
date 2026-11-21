/** MediaPipe Hand Landmarker gives 21 points per hand. */
export interface Pt { x: number; y: number; z: number; }

export const LM = { WRIST: 0, THUMB_TIP: 4, INDEX_MCP: 5, INDEX_PIP: 6, INDEX_TIP: 8, MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_TIP: 12, RING_PIP: 14, RING_TIP: 16, PINKY_MCP: 17, PINKY_TIP: 20 } as const;

export type V3 = [number, number, number];
// Vector helpers for 3D points.
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
// Dot product of two 3D vectors.
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Length (magnitude) of a 3D vector.
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
// Scales a vector to length 1.
export const unit = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// Distance between two 3D points.
export const dist = (a: V3, b: V3) => len(sub(a, b));
// Reads landmark i out of a flat 63-number array as a 3D point.
export const at = (n: number[], i: number): V3 => [n[3 * i], n[3 * i + 1], n[3 * i + 2]];

/** Rescales hand landmarks so size, distance, and which hand is used do not matter. */
export function normalize(raw: readonly Pt[], aspect = 1): number[] | null {
  if (raw.length !== 21) return null;
  const px = (p: Pt): V3 => [p.x * aspect, p.y, p.z * aspect];
  const w = px(raw[LM.WRIST]);
  const palm = dist(px(raw[LM.MIDDLE_MCP]), w);
  if (palm < 1e-6) return null;
  const a = sub(px(raw[LM.INDEX_MCP]), w), b = sub(px(raw[LM.PINKY_MCP]), w);
  const flip = a[0] * b[1] - a[1] * b[0] < 0 ? -1 : 1;
  const out: number[] = [];
  for (const p of raw) {
    const v = px(p);
    out.push(((v[0] - w[0]) / palm) * flip, (v[1] - w[1]) / palm, (v[2] - w[2]) / palm);
  }
  return out;
}
