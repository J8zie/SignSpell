import { Features, RULES } from './classifier';

/** Plain-language hand-shape cue for every letter (also shown in the letter guide). */
export const CUES: Record<string, string> = {
  A: 'Fist with the thumb along the side', B: 'Flat hand, fingers together, thumb across the palm', C: 'Curve your hand into a C',
  D: 'Index finger up, other fingers touch the thumb', E: 'Fingers bent down, thumb tucked underneath', F: 'Thumb and index touch, other three fingers up',
  G: 'Index finger and thumb point sideways', H: 'Index and middle fingers point sideways together', I: 'Fist with the pinky up',
  J: 'Pinky up, then draw a J in the air', K: 'Index and middle up in a V, thumb between them', L: 'Index finger up and thumb out, like an L',
  M: 'Thumb tucked under three fingers', N: 'Thumb tucked under two fingers', O: 'Fingers and thumb curve to touch, like an O',
  P: 'Like K, pointing down', Q: 'Like G, pointing down', R: 'Index and middle fingers crossed',
  S: 'Fist with the thumb across the front of the fingers', T: 'Fist with the thumb between index and middle', U: 'Index and middle fingers up together',
  V: 'Index and middle fingers up and apart', W: 'Index, middle and ring fingers up and apart', X: 'Index finger hooked',
  Y: 'Thumb and pinky out', Z: 'Draw a Z in the air with your index finger',
};

const NAMES = ['index', 'middle', 'ring', 'pinky'];

/** Builds a corrective hint by comparing the seen hand shape to what the expected sign needs. */
export function hintFor(expected: string, observed: string | null, f: Features | null): string {
  const cue = CUES[expected] ?? `Match the reference picture for ${expected}.`;
  const prefix = observed && observed !== expected ? `That looks like ${observed}. ` : '';
  const rule = RULES.find((r) => r.letter === expected);
  if (rule && f) {
    for (let i = 0; i < 4; i++) {
      const want = rule.fingers[i], have = f.fingers[i];
      if (want === have) continue;
      if (want === 'e') return `${prefix}Straighten your ${NAMES[i]} finger.`;
      if (want === 'c') return `${prefix}Curl your ${NAMES[i]} finger into your palm.`;
      if (have === 'e') return `${prefix}Bend your ${NAMES[i]} finger a little.`;
      return `${prefix}Straighten your ${NAMES[i]} finger a little.`;
    }
    if (rule.thumb === 'in' && f.thumb.out >= 0.65) return `${prefix}Tuck your thumb in across your palm.`;
    if (rule.thumb === 'out' && f.thumb.out < 0.65) return `${prefix}Move your thumb out to the side.`;
  }
  return `${prefix}${cue}.`;
}
