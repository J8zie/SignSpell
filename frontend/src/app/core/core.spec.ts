import { TestBed } from '@angular/core/testing';
import { levelFor, nextMastery } from './mastery';
import { labelProblem, normalizeLabel } from './util/sign-label';

describe('mastery rule', () => {
  it('maps attempts and accuracy to a level', () => {
    expect(levelFor(0, 0)).toBe('new');
    expect(levelFor(2, 1)).toBe('learning');
    expect(levelFor(3, 0.6)).toBe('familiar');
    expect(levelFor(5, 0.85)).toBe('mastered');
    expect(levelFor(10, 0.5)).toBe('learning');
  });
  it('keeps a running average', () => {
    let m = nextMastery(null, true);
    m = nextMastery(m, false);
    expect(m.attemptsCount).toBe(2);
    expect(m.correctAvg).toBeCloseTo(0.5);
  });
});

describe('sign labels', () => {
  it('normalizes and validates by type', () => {
    expect(normalizeLabel('  i   am here ')).toBe('I AM HERE');
    expect(labelProblem('letter', 'b')).toBeNull();
    expect(labelProblem('letter', 'bc')).not.toBeNull();
    expect(labelProblem('word', 'hello')).toBeNull();
    expect(labelProblem('word', 'a b')).not.toBeNull();
    expect(labelProblem('sentence', 'i am here')).toBeNull();
    expect(labelProblem('sentence', 'hello')).not.toBeNull();
    expect(labelProblem('word', 'h3llo')).not.toBeNull();
    expect(labelProblem('sentence', 'a b c d e f')).not.toBeNull();
  });
});

describe('ToastService', () => {
  it('keeps at most three toasts and merges duplicates', async () => {
    const { ToastService } = await import('./toast.service');
    const t = TestBed.inject(ToastService);
    ['a', 'b', 'c', 'd'].forEach((x) => t.show(x));
    expect(t.items().map((x) => x.text)).toEqual(['b', 'c', 'd']);
    t.show('c');
    expect(t.items().map((x) => x.text)).toEqual(['b', 'd', 'c']);
  });
});
