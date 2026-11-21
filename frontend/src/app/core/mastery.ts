import { Mastery, MasteryLevel } from './models';

/** Turns attempt count and accuracy into a mastery level (mirrors the API rule for instant UI updates). */
export function levelFor(attemptsCount: number, correctAvg: number): MasteryLevel {
  if (attemptsCount === 0) return 'new';
  if (attemptsCount >= 5 && correctAvg >= 0.85) return 'mastered';
  if (attemptsCount >= 3 && correctAvg >= 0.6) return 'familiar';
  return 'learning';
}

// Applies one attempt result to the previous mastery numbers.
export function nextMastery(prev: Pick<Mastery, 'attemptsCount' | 'correctAvg'> | null, isCorrect: boolean) {
  const n = prev?.attemptsCount ?? 0;
  const attemptsCount = n + 1;
  // Whole numbers, so the average never drifts (the API does the same sum).
  const correct = Math.round((prev?.correctAvg ?? 0) * n) + (isCorrect ? 1 : 0);
  const correctAvg = correct / attemptsCount;
  return { attemptsCount, correctAvg, masteryLevel: levelFor(attemptsCount, correctAvg) };
}

export const LEVEL_LABEL: Record<MasteryLevel, string> = { new: 'New', learning: 'Learning', familiar: 'Familiar', mastered: 'Mastered' };
