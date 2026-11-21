import { classifyPath, PathPoint } from './path-rule';
import { features, lookAlike, recognize, RULE_LETTERS } from './classifier';
import { PracticeEngine } from './engine';
import { FrameVoter } from './frame-voter';
import { hintFor } from './hints';
import { lightingIssue, measure, visibilityIssue } from './lighting';
import { normalize, Pt } from './landmarks';
import { SequenceBuilder } from './sequence-builder';
import { flat, LETTER_POSES, makeHand } from './testing/synthetic-hand';

describe('normalize', () => {
  const hand = makeHand(LETTER_POSES['B']);
  it('ignores hand size and position', () => {
    const moved = hand.map((p) => ({ x: p.x * 0.3 + 0.4, y: p.y * 0.3 + 0.6, z: p.z * 0.3 }));
    const a = normalize(hand)!, b = normalize(moved)!;
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 6));
  });
  it('mirrors a left hand onto the same numbers as a right hand, without using any Left/Right label', () => {
    const mirrored: Pt[] = hand.map((p) => ({ ...p, x: -p.x }));
    const right = normalize(hand)!, left = normalize(mirrored)!;
    right.forEach((v, i) => expect(left[i]).toBeCloseTo(v, 6));
  });
  it('rejects a broken hand', () => {
    expect(normalize(hand.slice(0, 5))).toBeNull();
    expect(normalize(hand.map(() => ({ x: 0.5, y: 0.5, z: 0 })))).toBeNull();
  });
});

describe('classifier and look-alike rules', () => {
  for (const [letter, spec] of Object.entries(LETTER_POSES)) {
    it(`recognizes ${letter}`, () => {
      const r = recognize(flat(makeHand(spec)));
      expect(r.label).toBe(letter);
      expect(r.confidence).toBeGreaterThan(0.5);
    });
  }
  it('tells A, S, T, N and M apart by the thumb', () => {
    const got = ['A', 'S', 'T', 'N', 'M'].map((l) => lookAlike(features(flat(makeHand(LETTER_POSES[l]))))?.label);
    expect(got).toEqual(['A', 'S', 'T', 'N', 'M']);
  });
  it('overrides a trained model that confuses a look-alike', () => {
    const wrongModel = { classify: () => ({ label: 'S', confidence: 0.9 }) };
    expect(recognize(flat(makeHand(LETTER_POSES['M'])), wrongModel).label).toBe('M');
  });
  it('returns nothing for an open hand with the thumb out', () => {
    const open = makeHand({ fingers: ['e', 'e', 'e', 'e'], thumbAbs: [-1.0, -0.6, 0] });
    expect(recognize(flat(open)).label).toBeNull();
  });
  it('lists which letters the baseline covers', () => {
    expect(RULE_LETTERS).toContain('J');
    expect(RULE_LETTERS).not.toContain('E');
  });
});

describe('hints', () => {
  it('names the finger to fix', () => {
    const f = features(flat(makeHand({ fingers: ['e', 'e', 'e', 'c'], thumb: { u: 0.45, v: -0.35 } })));
    expect(hintFor('B', 'W', f)).toBe('That looks like W. Straighten your pinky finger.');
  });
  it('tells the thumb fix', () => {
    const f = features(flat(makeHand({ fingers: ['e', 'e', 'e', 'e'], thumbAbs: [-1.0, -0.6, 0] })));
    expect(hintFor('B', null, f)).toContain('Tuck your thumb');
  });
  it('always gives a hint, even for letters the baseline cannot check', () => {
    expect(hintFor('R', 'U', null)).toBe('That looks like U. Index and middle fingers crossed.');
  });
});

describe('FrameVoter', () => {
  it('confirms only after about one second of the same letter', () => {
    const v = new FrameVoter();
    let last = v.push(0, 'A', 0.9);
    for (let t = 33; t <= 800; t += 33) last = v.push(t, 'A', 0.9);
    expect(last.confirmed).toBe(false);
    for (let t = 833; t <= 1000; t += 33) last = v.push(t, 'A', 0.9);
    expect(last.confirmed).toBe(true);
    expect(last.candidate).toBe('A');
  });
  it('does not flicker when a few frames disagree', () => {
    const v = new FrameVoter();
    let last = v.push(0, 'B', 0.9);
    for (let t = 33; t <= 1100; t += 33) last = v.push(t, t % 330 === 0 ? 'C' : 'B', 0.9);
    expect(last.confirmed).toBe(true);
    expect(last.candidate).toBe('B');
  });
  it('never confirms a hand that keeps changing', () => {
    const v = new FrameVoter();
    let any = false;
    for (let t = 0; t <= 3000; t += 33) any = v.push(t, ['A', 'B', 'C'][Math.floor(t / 33) % 3], 0.9).confirmed || any;
    expect(any).toBe(false);
  });
});

describe('SequenceBuilder', () => {
  it('builds a sentence with the Space button', () => {
    const b = new SequenceBuilder('I AM');
    expect(b.accept('I')).toBe(true);
    expect(b.needsSpace).toBe(true);
    expect(b.accept('A')).toBe(false);
    expect(b.pressSpace()).toBe(true);
    expect(b.accept('A')).toBe(true);
    expect(b.accept('M')).toBe(true);
    expect(b.done).toBe(true);
    expect(b.built).toBe('I AM');
  });
});

/** Feeds one sign at 30 fps for `ms` and returns every event. */
function hold(engine: PracticeEngine, clock: { t: number }, label: string | null, ms: number) {
  const events: unknown[] = [];
  for (let i = 0; i < ms / 33; i++) {
    clock.t += 33;
    const tick = engine.step(clock.t, label ? { label, confidence: 0.9 } : null);
    if (tick.event) events.push(tick.event);
  }
  return events;
}

describe('PracticeEngine', () => {
  it('letter mode: right sign is correct once and finishes', () => {
    const e = new PracticeEngine('C', 'letter'), c = { t: 0 };
    const ev = hold(e, c, 'C', 1500);
    expect(ev).toEqual([{ type: 'correct', label: 'C', confidence: expect.any(Number), complete: true }]);
    expect(e.done).toBe(true);
  });
  it('letter mode: a wrong sign counts once until the hand changes', () => {
    const e = new PracticeEngine('C', 'letter'), c = { t: 0 };
    expect(hold(e, c, 'O', 3000)).toHaveLength(1);
    hold(e, c, null, 400);
    expect(hold(e, c, 'O', 1500)).toHaveLength(1);
    expect(hold(e, c, 'C', 2500)).toEqual([expect.objectContaining({ type: 'correct' })]);
  });
  it('a short flash of the right sign is ignored', () => {
    const e = new PracticeEngine('C', 'letter'), c = { t: 0 };
    expect(hold(e, c, 'C', 500)).toHaveLength(0);
  });
  it('word mode: HELLO needs a fresh sign for the repeated L', () => {
    const e = new PracticeEngine('HELLO', 'word'), c = { t: 0 };
    const got: string[] = [];
    const feed = (l: string | null, ms: number) => hold(e, c, l, ms).forEach((x: any) => got.push(x.type === 'correct' ? x.label : '!' + x.label));
    feed('H', 1300); feed('E', 1500); feed('L', 1500);
    feed('L', 1500); // same hold continues: must not count again
    expect(got).toEqual(['H', 'E', 'L']);
    feed(null, 400);
    feed('L', 1500); feed('O', 1500);
    expect(got).toEqual(['H', 'E', 'L', 'L', 'O']);
    expect(e.done).toBe(true);
  });
  it('word mode: a wrong letter does not advance', () => {
    const e = new PracticeEngine('CAT', 'word'), c = { t: 0 };
    const ev = hold(e, c, 'X', 1500) as any[];
    expect(ev[0]).toEqual({ type: 'wrong', label: 'X', expected: 'C', confidence: expect.any(Number) });
    expect(e.builder.built).toBe('');
  });
  it('sentence mode waits for the Space button', () => {
    const e = new PracticeEngine('I AM', 'sentence'), c = { t: 0 };
    hold(e, c, 'I', 1500);
    hold(e, c, null, 400);
    expect(hold(e, c, 'A', 1500)).toHaveLength(0);
    expect(e.pressSpace()).toBe(true);
    expect(hold(e, c, 'A', 1500)).toHaveLength(1);
  });
});

describe('path rule (J and Z)', () => {
  const path = (pts: [number, number][]): PathPoint[] => {
    const out: PathPoint[] = [];
    pts.slice(1).forEach((p, i) => { for (let s = 0; s < 8; s++) out.push({ x: pts[i][0] + (p[0] - pts[i][0]) * s / 8, y: pts[i][1] + (p[1] - pts[i][1]) * s / 8, t: out.length * 30 }); });
    return out;
  };
  it('reads a J: down, then hook', () => expect(classifyPath(path([[0, 0], [0, 1.2], [-0.6, 1.5]]))).toBe('J'));
  it('reads a Z: across, diagonal, across', () => expect(classifyPath(path([[0, 0], [1, 0], [0, 1], [1, 1]]))).toBe('Z'));
  it('ignores a straight line and a still hand', () => {
    expect(classifyPath(path([[0, 0], [0, 1.5]]))).toBeNull();
    expect(classifyPath(Array.from({ length: 10 }, (_, i) => ({ x: 0, y: 0, t: i * 30 })))).toBeNull();
  });
});

describe('lighting and visibility', () => {
  const frame = (v: number, spread = 0) => { const a = new Uint8ClampedArray(400); for (let i = 0; i < 400; i += 4) { const x = v + (i % 8 === 0 ? spread : -spread); a.set([x, x, x, 255], i); } return a; };
  it('flags dark, bright and flat pictures', () => {
    expect(lightingIssue(...(Object.values(measure(frame(20, 5))) as [number, number]))).toBe('dark');
    expect(lightingIssue(...(Object.values(measure(frame(240, 5))) as [number, number]))).toBe('bright');
    expect(lightingIssue(...(Object.values(measure(frame(128, 2))) as [number, number]))).toBe('flat');
    expect(lightingIssue(...(Object.values(measure(frame(128, 50))) as [number, number]))).toBeNull();
  });
  const box = (x0: number, y0: number, w: number): Pt[] => Array.from({ length: 21 }, (_, i) => ({ x: x0 + (i % 2) * w, y: y0 + (i % 3 === 0 ? w : 0), z: 0 }));
  it('checks the hand is visible, sized and inside the picture', () => {
    expect(visibilityIssue(null)).toBe('none');
    expect(visibilityIssue(box(0.4, 0.3, 0.3))).toBeNull();
    expect(visibilityIssue(box(0.4, 0.3, 0.1))).toBe('far');
    expect(visibilityIssue(box(0.0, 0.3, 0.3))).toBe('edge');
  });
});
