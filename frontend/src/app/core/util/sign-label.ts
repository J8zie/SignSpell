import { SignType } from '../models';

// Trims, collapses spaces, and uppercases a label.
export const normalizeLabel = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase();

/** Same rules the API must enforce. Returns a message, or null when the label is fine. */
export function labelProblem(type: SignType, raw: string): string | null {
  const label = normalizeLabel(raw);
  if (!label) return 'Enter the letter, word or sentence.';
  if (!/^[A-Z]+( [A-Z]+){0,4}$/.test(label)) return 'Use letters A to Z only, up to five words.';
  if (type === 'letter' && label.length !== 1) return 'A letter sign has exactly one letter.';
  if (type === 'word' && (label.includes(' ') || label.length < 2 || label.length > 12)) return 'A word is 2 to 12 letters with no spaces.';
  if (type === 'sentence' && !label.includes(' ')) return 'A sentence has two to five words.';
  return null;
}
