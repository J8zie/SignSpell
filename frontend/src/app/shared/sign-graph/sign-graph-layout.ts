import { MasteryLevel } from '../../core/models';

/** Pure layout maths for the sign graph: positions every node and draws the connecting curves. */

export type GraphKind = 'letter' | 'word' | 'sentence';

/** One sign in the graph. */
export interface GraphNode {
  id: string;
  label: string;
  kind: GraphKind;
  /** How well learners know this sign. Leave it out when nobody has practiced it yet. */
  level?: MasteryLevel | null;
  /** A short line shown under the graph when the node is chosen, for example "2 learners · 54%". */
  detail?: string;
}

/** A relationship: `from` is made of `to` (a word of its letters, a sentence of its words). */
export interface GraphEdge { from: string; to: string; }

export interface PlacedNode extends GraphNode { x: number; y: number; w: number; h: number; }
export interface PlacedEdge { from: string; to: string; d: string; }
export interface GraphLayout { nodes: PlacedNode[]; edges: PlacedEdge[]; width: number; height: number; }

const ROW_Y: Record<GraphKind, number> = { sentence: 52, word: 168, letter: 284 };
const HEIGHT = 336;
const MARGIN = 32;
const GAP = 14;
const LETTER_STEP = 46;

/** How wide a node is: letters are small circles, words and sentences are pills that grow with their text. */
export const nodeWidth = (n: Pick<GraphNode, 'kind' | 'label'>): number => (n.kind === 'letter' ? 36 : Math.max(52, n.label.length * 9.5 + 26));

/** Pushes the nodes of one row apart left to right so none overlap, keeping their wished x as close as possible. */
function spread(row: PlacedNode[]): void {
  row.sort((a, b) => a.x - b.x);
  for (let i = 1; i < row.length; i++) {
    const min = row[i - 1].x + (row[i - 1].w + row[i].w) / 2 + GAP;
    if (row[i].x < min) row[i].x = min;
  }
}

/** Where every node and line goes. */
export function layoutSignGraph(nodes: GraphNode[], edges: GraphEdge[]): GraphLayout {
  const ids = new Set(nodes.map((n) => n.id));
  const valid = edges.filter((e) => ids.has(e.from) && ids.has(e.to)); // lines to signs that are not in the graph are dropped
  const placed = new Map<string, PlacedNode>();
  // Creates a placed node in its row and remembers it by id.
  const make = (n: GraphNode, x: number): PlacedNode => {
    const p = { ...n, x, y: ROW_Y[n.kind], w: nodeWidth(n), h: n.kind === 'letter' ? 36 : 36 };
    placed.set(n.id, p);
    return p;
  };

  // 1. Letters sit in a row in alphabetical order.
  const letters = nodes.filter((n) => n.kind === 'letter').sort((a, b) => a.label.localeCompare(b.label));
  letters.forEach((n, i) => make(n, MARGIN + 18 + i * LETTER_STEP));

  // 2. A word hangs above the middle of its letters; a sentence above the middle of its parts.
  // Places one row of nodes above the row they are made of, then spreads them apart.
  const above = (kind: GraphKind): PlacedNode[] => {
    const row = nodes.filter((n) => n.kind === kind).map((n, i) => {
      const parts = valid.filter((e) => e.from === n.id).map((e) => placed.get(e.to)).filter((p): p is PlacedNode => !!p);
      const x = parts.length ? parts.reduce((s, p) => s + p.x, 0) / parts.length : MARGIN + 40 + i * 120;
      return make(n, x);
    });
    spread(row);
    return row;
  };
  above('word');
  above('sentence');

  // 3. Make the picture exactly wide enough, with the same margin on both sides.
  const all = [...placed.values()];
  const left = Math.min(...all.map((p) => p.x - p.w / 2), MARGIN);
  const shift = MARGIN - left;
  all.forEach((p) => (p.x += shift));
  const width = Math.max(320, Math.max(...all.map((p) => p.x + p.w / 2), 0) + MARGIN);

  // 4. A soft curve from each part (below) up to the sign made of it (above).
  const lines = valid.map((e) => {
    const a = placed.get(e.from)!, b = placed.get(e.to)!;
    const y1 = a.y + a.h / 2, y2 = b.y - b.h / 2, mid = (y1 + y2) / 2;
    return { from: e.from, to: e.to, d: `M${a.x.toFixed(1)} ${y1} C${a.x.toFixed(1)} ${mid}, ${b.x.toFixed(1)} ${mid}, ${b.x.toFixed(1)} ${y2}` };
  });
  return { nodes: all, edges: lines, width, height: HEIGHT };
}

/** The ids of a node and everything joined to it (used to highlight the chosen node's neighbourhood). */
export function neighbourhood(id: string, edges: GraphEdge[]): Set<string> {
  const set = new Set([id]);
  for (const e of edges) {
    if (e.from === id) set.add(e.to);
    if (e.to === id) set.add(e.from);
  }
  return set;
}
