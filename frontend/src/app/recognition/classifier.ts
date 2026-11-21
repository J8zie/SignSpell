import { at, dist, dot, len, sub, unit, V3 } from './landmarks';

/** Every number a rule may need to tune is here. Adjust with your volunteer data. */
export const TUNE = { extended: 1.2, curled: 0.92, adjacent: 0.8, minQuality: 0.64, touch: 0.35, thumbOut: 0.65, tipsClose: 0.38, front: 0.1 };

export type FState = 'e' | 'h' | 'c'; // extended, half-bent, curled
export interface ThumbFeatures { out: number; u: number; v: number; front: boolean; toIndexTip: number; toMiddleTip: number; toMiddlePip: number; }
export interface Features { fingers: FState[]; ratios: number[]; gapIM: number; thumb: ThumbFeatures; }
export interface Recognition { label: string | null; confidence: number; features: Features; }
export interface LandmarkClassifier { classify(n: number[]): { label: string | null; confidence: number }; }

// Turns a finger-length ratio into extended, half-bent, or curled.
const stateOf = (r: number): FState => (r >= TUNE.extended ? 'e' : r < TUNE.curled ? 'c' : 'h');

/** Reads finger states and thumb position from 63 normalized numbers. */
export function features(n: number[]): Features {
  const p = (i: number) => at(n, i);
  const wrist = p(0);
  const ratios = [[8, 6], [12, 10], [16, 14], [20, 18]].map(([tip, pip]) => dist(p(tip), wrist) / Math.max(1e-6, dist(p(pip), wrist)));
  const idx = p(5), pinky = p(17);
  const uAxis = unit(sub(pinky, idx));
  let vAxis = unit(sub(p(9), wrist));
  const k = dot(vAxis, uAxis);
  vAxis = unit([vAxis[0] - k * uAxis[0], vAxis[1] - k * uAxis[1], vAxis[2] - k * uAxis[2]]);
  const tip = p(4);
  const rel = sub(tip, idx);
  const width = dist(idx, pinky) || 1;
  const pipZ = (p(6)[2] + p(10)[2] + p(14)[2]) / 3;
  return {
    fingers: ratios.map(stateOf), ratios, gapIM: dist(p(8), p(12)),
    thumb: {
      out: len(rel), u: dot(rel, uAxis) / width, v: dot(rel, vAxis), front: tip[2] < pipZ - TUNE.front,
      toIndexTip: dist(tip, p(8)), toMiddleTip: dist(tip, p(12)), toMiddlePip: dist(tip, p(10)),
    },
  };
}

/** Step 4: look-alike rules. Conditionals on thumb position separate A, M, N, S and T. */
export function lookAlike(f: Features): { label: string; confidence: number } | null {
  if (f.fingers.some((s) => s === 'e')) return null;
  const t = f.thumb;
  if (t.u < -0.15 && t.out > 0.5) return { label: 'A', confidence: 0.85 };
  if (t.front && t.v > 0.35 && t.u > -0.15 && t.u < 0.7) return { label: 'S', confidence: 0.82 };
  if (t.u >= 0.55) return { label: 'M', confidence: 0.78 };
  if (t.u >= 0.3) return { label: 'N', confidence: 0.78 };
  if (t.u >= -0.15) return { label: 'T', confidence: 0.78 };
  return null;
}
export const LOOK_ALIKES = ['A', 'M', 'N', 'S', 'T'];

interface Rule { letter: string; fingers: string; ok?: (f: Features) => boolean; thumb?: 'in' | 'out'; }
/** Finger pattern is index, middle, ring, pinky. Letters not listed (E G H P Q R) need the trained model. */
export const RULES: Rule[] = [
  { letter: 'B', fingers: 'eeee', thumb: 'in' },
  { letter: 'W', fingers: 'eeec' },
  { letter: 'U', fingers: 'eecc', ok: (f) => f.gapIM < TUNE.tipsClose },
  { letter: 'V', fingers: 'eecc', ok: (f) => f.gapIM >= TUNE.tipsClose && f.thumb.toMiddlePip >= TUNE.touch },
  { letter: 'K', fingers: 'eecc', ok: (f) => f.gapIM >= TUNE.tipsClose && f.thumb.toMiddlePip < TUNE.touch },
  { letter: 'L', fingers: 'eccc', thumb: 'out', ok: (f) => f.thumb.toMiddleTip >= 0.45 },
  { letter: 'D', fingers: 'eccc', ok: (f) => f.thumb.toMiddleTip < 0.45 },
  { letter: 'X', fingers: 'hccc' },
  { letter: 'I', fingers: 'ccce', thumb: 'in' },
  { letter: 'Y', fingers: 'ccce', thumb: 'out' },
  { letter: 'F', fingers: 'ceee', ok: (f) => f.thumb.toIndexTip < TUNE.touch },
  { letter: 'O', fingers: 'hhhh', ok: (f) => f.thumb.toIndexTip < TUNE.touch },
  { letter: 'C', fingers: 'hhhh', thumb: 'out', ok: (f) => f.thumb.toIndexTip >= 0.45 },
];
export const RULE_LETTERS = [...RULES.map((r) => r.letter), ...LOOK_ALIKES, 'J', 'Z'].filter((l, i, a) => a.indexOf(l) === i).sort();

// Scores how well a finger pattern matches a rule; opposite states score zero.
function quality(pattern: string, f: Features): number {
  let q = 1;
  for (let i = 0; i < 4; i++) {
    const a = pattern[i], b = f.fingers[i];
    if (a === b) continue;
    if (a === 'e' && b === 'c' || a === 'c' && b === 'e') return 0;
    q *= TUNE.adjacent;
  }
  return q;
}

/** Built-in baseline classifier: finger states + thumb rules. Replace or combine with the trained model. */
export function ruleClassify(f: Features): { label: string | null; confidence: number } {
  let best: { label: string; q: number } | null = null;
  for (const r of RULES) {
    if (r.thumb === 'in' && f.thumb.out >= TUNE.thumbOut) continue;
    if (r.thumb === 'out' && f.thumb.out < TUNE.thumbOut) continue;
    if (r.ok && !r.ok(f)) continue;
    const q = quality(r.fingers, f);
    if (q >= TUNE.minQuality && (!best || q > best.q)) best = { label: r.letter, q };
  }
  const fist = quality('cccc', f);
  if (fist >= TUNE.minQuality && (!best || fist > best.q)) {
    const la = lookAlike(f);
    if (la) return la;
  }
  return best ? { label: best.label, confidence: Math.min(0.95, 0.55 + 0.4 * best.q) } : { label: null, confidence: 0 };
}

/** k-nearest-neighbour classifier over normalized landmark samples (see docs/RECOGNITION.md). */
export class KnnClassifier implements LandmarkClassifier {
  constructor(private samples: { l: string; f: number[] }[], private k = 5) {}
  // Guesses the letter by majority vote of the k closest landmark samples.
  classify(n: number[]) {
    const near = this.samples
      .map((s) => { let d = 0; for (let i = 0; i < 63; i++) d += (s.f[i] - n[i]) ** 2; return { l: s.l, d }; })
      .sort((a, b) => a.d - b.d)
      .slice(0, this.k);
    const votes = new Map<string, number>();
    near.forEach((x) => votes.set(x.l, (votes.get(x.l) ?? 0) + 1));
    const [label, count] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    return { label: label as string | null, confidence: count / this.k };
  }
}

/** Steps 3 and 4 together: classify, then let the look-alike rules re-decide A, M, N, S and T. */
export function recognize(n: number[], trained?: LandmarkClassifier | null): Recognition {
  const f = features(n);
  let r = trained ? trained.classify(n) : ruleClassify(f);
  if (r.label && LOOK_ALIKES.includes(r.label)) {
    const la = lookAlike(f);
    if (la) r = { label: la.label, confidence: Math.min(r.confidence || 1, la.confidence) };
  }
  return { ...r, features: f };
}
