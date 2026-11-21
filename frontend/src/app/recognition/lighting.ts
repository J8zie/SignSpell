import { Pt } from './landmarks';

export type LightingIssue = 'dark' | 'bright' | 'flat';
export type VisibilityIssue = 'none' | 'far' | 'near' | 'edge';

export const LIGHTING_TEXT: Record<LightingIssue, string> = {
  dark: 'It is too dark. Face a light or a window.',
  bright: 'It is too bright or backlit. Turn away from the light behind you.',
  flat: 'The picture looks washed out. Use a plain background and even light.',
};
export const VISIBILITY_TEXT: Record<VisibilityIssue, string> = {
  none: 'Show one hand to the camera.',
  far: 'Move your hand closer to the camera.',
  near: 'Move your hand back a little.',
  edge: 'Keep your whole hand inside the picture.',
};

/** Mean brightness (0-255) and contrast of an RGBA pixel buffer sampled from the camera. */
export function measure(rgba: Uint8ClampedArray): { mean: number; contrast: number } {
  let sum = 0, sumSq = 0;
  const n = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) {
    const y = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    sum += y; sumSq += y * y;
  }
  const mean = sum / n;
  return { mean, contrast: Math.sqrt(Math.max(0, sumSq / n - mean * mean)) };
}

/** Turns brightness numbers into a lighting problem, or null when the light is fine. */
export function lightingIssue(mean: number, contrast: number): LightingIssue | null {
  if (mean < 55) return 'dark';
  if (mean > 220) return 'bright';
  if (contrast < 12) return 'flat';
  return null;
}

/** Landmarks are in 0..1 picture coordinates. */
/** Checks whether the hand is visible, centered, and a good size in the frame. */
export function visibilityIssue(lm: readonly Pt[] | null): VisibilityIssue | null {
  if (!lm || lm.length < 21) return 'none';
  const xs = lm.map((p) => p.x), ys = lm.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  if (minX < 0.02 || maxX > 0.98 || minY < 0.02 || maxY > 0.98) return 'edge';
  const size = Math.max(maxX - minX, maxY - minY);
  if (size < 0.2) return 'far';
  if (size > 0.92) return 'near';
  return null;
}
