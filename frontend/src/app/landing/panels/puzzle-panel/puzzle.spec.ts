import { buildPuzzle } from './puzzle';

describe('buildPuzzle', () => {
  const pieces = buildPuzzle(5, 3, 1000, 600);

  it('makes one closed piece per cell', () => {
    expect(pieces.length).toBe(15);
    expect(pieces.every((p) => p.d.startsWith('M') && p.d.endsWith('Z'))).toBe(true);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(15);
  });

  it('gives every inner edge a knob on one side and a hole on the other, and the border stays flat', () => {
    // 5x3 pieces have 4*3 + 5*2 = 22 inner edges, and each is drawn twice (once per neighbour) = 44 arcs
    const arcs = pieces.reduce((n, p) => n + (p.d.match(/A/g)?.length ?? 0), 0);
    expect(arcs).toBe(44);
    // knobs (sweep 1) and holes (sweep 0) are always paired
    const knobs = pieces.reduce((n, p) => n + (p.d.match(/ 0 1 1 /g)?.length ?? 0), 0);
    const holes = pieces.reduce((n, p) => n + (p.d.match(/ 0 1 0 /g)?.length ?? 0), 0);
    expect(knobs).toBe(22);
    expect(holes).toBe(22);
  });

  it('is repeatable', () => {
    expect(buildPuzzle(5, 3, 1000, 600)).toEqual(pieces);
  });
});
