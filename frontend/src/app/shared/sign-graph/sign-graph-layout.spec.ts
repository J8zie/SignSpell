import { GraphEdge, GraphNode, layoutSignGraph, neighbourhood } from './sign-graph-layout';

const letter = (l: string): GraphNode => ({ id: 'L' + l, label: l, kind: 'letter' });
const word = (w: string): GraphNode => ({ id: 'W' + w, label: w, kind: 'word' });
const spelled = (w: string): GraphEdge[] => [...new Set(w.split(''))].map((l) => ({ from: 'W' + w, to: 'L' + l }));

describe('sign graph layout', () => {
  const nodes = [...'HELOCAT'.split('').map(letter), word('HELLO'), word('CAT')];
  const edges = [...spelled('HELLO'), ...spelled('CAT')];
  const layout = layoutSignGraph(nodes, edges);

  it('puts letters in alphabetical order on the bottom row', () => {
    const row = layout.nodes.filter((n) => n.kind === 'letter');
    expect(row.map((n) => n.label).join('')).toBe('ACEHLOT');
    expect(new Set(row.map((n) => n.y)).size).toBe(1);
  });

  it('hangs a word above the middle of its letters', () => {
    const hello = layout.nodes.find((n) => n.label === 'HELLO')!;
    const xs = ['H', 'E', 'L', 'O'].map((l) => layout.nodes.find((n) => n.label === l)!.x);
    // the word may be pushed sideways to avoid a neighbour, but never far from the middle of its letters
    expect(Math.abs(hello.x - xs.reduce((a, b) => a + b) / xs.length)).toBeLessThan(80);
    expect(hello.y).toBeLessThan(layout.nodes.find((n) => n.label === 'H')!.y);
  });

  it('never lets two signs on the same row overlap', () => {
    for (const kind of ['letter', 'word'] as const) {
      const row = layout.nodes.filter((n) => n.kind === kind).sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) expect(row[i].x - row[i - 1].x).toBeGreaterThanOrEqual((row[i].w + row[i - 1].w) / 2);
    }
  });

  it('keeps every sign inside the picture', () => {
    for (const n of layout.nodes) { expect(n.x - n.w / 2).toBeGreaterThanOrEqual(0); expect(n.x + n.w / 2).toBeLessThanOrEqual(layout.width); }
  });

  it('draws only lines whose two ends exist, and invents none', () => {
    const withGhost = layoutSignGraph(nodes, [...edges, { from: 'WHELLO', to: 'LZ' }]);
    expect(withGhost.edges.length).toBe(edges.length);
  });

  it('finds the neighbourhood of a sign', () => {
    expect([...neighbourhood('WCAT', edges)].sort()).toEqual(['LA', 'LC', 'LT', 'WCAT']);
  });
});
