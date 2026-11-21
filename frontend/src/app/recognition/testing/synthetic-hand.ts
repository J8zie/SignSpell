import { Pt } from '../landmarks';

/** Builds 21 landmarks in "palm units": wrist at 0,0 and the middle knuckle one unit up (y is down). Test helper only. */
export type Finger = 'e' | 'h' | 'c';
export interface HandSpec {
  fingers: [Finger, Finger, Finger, Finger];
  /** x offset of each fingertip (pip/dip move by a share of it) */
  lean?: [number, number, number, number];
  /** thumb tip relative to the index knuckle: u across the palm (0 index, 1 pinky), v up, z toward camera (negative) */
  thumb?: { u: number; v: number; z?: number };
  /** or an absolute thumb tip position */
  thumbAbs?: [number, number, number];
}
const MCP: [number, number][] = [[-0.38, -0.92], [0, -1], [0.34, -0.94], [0.64, -0.8]];
const SCALE = [0.95, 1, 0.95, 0.75];
const SHAPE: Record<Finger, [number, number, number]> = { e: [0.42, 0.68, 0.88], h: [0.4, 0.45, 0.35], c: [0.3, 0.18, 0.03] };

// Builds 21 fake landmarks for a hand pose, for tests only.
export function makeHand(spec: HandSpec): Pt[] {
  const pts: Pt[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  const set = (i: number, x: number, y: number, z = 0) => (pts[i] = { x, y, z });
  set(0, 0, 0);
  spec.fingers.forEach((state, f) => {
    const [mx, my] = MCP[f];
    const [a, b, c] = SHAPE[state].map((s) => s * SCALE[f]);
    const lean = spec.lean?.[f] ?? 0;
    const base = 5 + f * 4;
    set(base, mx, my);
    set(base + 1, mx + lean * 0.33, my - a);
    set(base + 2, mx + lean * 0.66, my - b);
    set(base + 3, mx + lean, my - c);
  });
  // thumb joints are only decoration for the overlay; the tip drives the features
  set(1, -0.3, -0.25); set(2, -0.5, -0.5);
  let tip: [number, number, number];
  if (spec.thumbAbs) tip = spec.thumbAbs;
  else {
    const t = spec.thumb ?? { u: 0, v: 0 };
    const idx = pts[5], pinky = pts[17];
    const w = Math.hypot(pinky.x - idx.x, pinky.y - idx.y);
    const u: [number, number] = [(pinky.x - idx.x) / w, (pinky.y - idx.y) / w];
    let v: [number, number] = [0, -1];
    const k = v[0] * u[0] + v[1] * u[1];
    v = [v[0] - k * u[0], v[1] - k * u[1]];
    const vl = Math.hypot(v[0], v[1]);
    v = [v[0] / vl, v[1] / vl];
    const pipZ = 0;
    tip = [idx.x + t.u * w * u[0] + t.v * v[0], idx.y + t.u * w * u[1] + t.v * v[1], pipZ + (t.z ?? 0)];
  }
  set(4, ...tip);
  set(3, (pts[2].x + tip[0]) / 2, (pts[2].y + tip[1]) / 2, tip[2] / 2);
  return pts;
}

/** Flatten like normalize() would for a hand that is already in palm units. */
// Flattens landmarks into the same 63-number format normalize() produces.
export const flat = (pts: Pt[]): number[] => pts.flatMap((p) => [p.x, p.y, p.z]);

export const LETTER_POSES: Record<string, HandSpec> = {
  A: { fingers: ['c', 'c', 'c', 'c'], thumb: { u: -0.35, v: 0.5 } },
  S: { fingers: ['c', 'c', 'c', 'c'], thumb: { u: 0.2, v: 0.55, z: -0.25 } },
  T: { fingers: ['c', 'c', 'c', 'c'], thumb: { u: 0.15, v: 0.2, z: 0.1 } },
  N: { fingers: ['c', 'c', 'c', 'c'], thumb: { u: 0.4, v: 0.15, z: 0.1 } },
  M: { fingers: ['c', 'c', 'c', 'c'], thumb: { u: 0.7, v: 0.1, z: 0.1 } },
  B: { fingers: ['e', 'e', 'e', 'e'], thumb: { u: 0.45, v: -0.35 } },
  I: { fingers: ['c', 'c', 'c', 'e'], thumb: { u: 0.3, v: -0.3 } },
  Y: { fingers: ['c', 'c', 'c', 'e'], thumb: { u: -0.9, v: -0.1 } },
  L: { fingers: ['e', 'c', 'c', 'c'], thumb: { u: -0.8, v: 0.1 } },
  D: { fingers: ['e', 'c', 'c', 'c'], thumbAbs: [-0.08, -0.98, 0] },
  U: { fingers: ['e', 'e', 'c', 'c'], lean: [0.28, 0, 0, 0], thumbAbs: [0.3, -0.85, 0] },
  V: { fingers: ['e', 'e', 'c', 'c'], lean: [-0.2, 0.1, 0, 0], thumbAbs: [0.3, -0.85, 0] },
  K: { fingers: ['e', 'e', 'c', 'c'], lean: [-0.2, 0.1, 0, 0], thumbAbs: [-0.05, -1.35, 0] },
  W: { fingers: ['e', 'e', 'e', 'c'], lean: [-0.15, 0, 0.15, 0], thumbAbs: [0.5, -0.8, 0] },
  F: { fingers: ['c', 'e', 'e', 'e'], thumbAbs: [-0.35, -0.9, 0] },
  O: { fingers: ['h', 'h', 'h', 'h'], thumbAbs: [-0.3, -1.2, 0] },
  C: { fingers: ['h', 'h', 'h', 'h'], thumbAbs: [-1.1, -0.7, 0] },
  X: { fingers: ['h', 'c', 'c', 'c'], thumb: { u: 0.2, v: 0.1, z: 0.1 } },
};
