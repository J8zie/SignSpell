/**
 * Cuts a rectangle into jigsaw pieces. Every inner edge has a round knob on one piece and a matching hole on its
 * neighbour, so the pieces really interlock. Paths are in the coordinates of the whole picture.
 */
export interface PuzzlePiece {
  id: number;
  col: number;
  row: number;
  /** SVG path of the piece, clockwise. */
  d: string;
  /** Centre of the piece cell (the point it turns around). */
  cx: number;
  cy: number;
}

/** A repeatable "random" sign (+1 or -1) for an inner edge, so the knobs look mixed but never change between runs. */
function sign(a: number, b: number): 1 | -1 {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x) > 0.5 ? 1 : -1;
}

/** One edge from (x0,y0) to (x1,y1). s > 0: knob pointing out of the piece. s < 0: a hole. 0: flat border. */
function edge(x0: number, y0: number, x1: number, y1: number, s: number): string {
  if (!s) return `L${x1} ${y1}`;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const a = [x0 + dx * 0.38, y0 + dy * 0.38];
  const b = [x0 + dx * 0.62, y0 + dy * 0.62];
  const r = len * 0.13; // a little wider than half the neck, so the knob is a mushroom
  const round = (n: number) => Math.round(n * 100) / 100;
  // the path always goes clockwise around the piece, so sweep 1 bulges outward and sweep 0 inward
  return `L${round(a[0])} ${round(a[1])} A${round(r)} ${round(r)} 0 1 ${s > 0 ? 1 : 0} ${round(b[0])} ${round(b[1])} L${x1} ${y1}`;
}

export function buildPuzzle(cols: number, rows: number, width: number, height: number): PuzzlePiece[] {
  const cw = width / cols, ch = height / rows;
  // V[r][c]: knob between (r,c) and (r,c+1), +1 = it belongs to the left piece. H[r][c]: same for (r,c) and (r+1,c).
  const V = (r: number, c: number) => sign(r + 1, c + 1);
  const H = (r: number, c: number) => sign(r + 101, c + 7);
  const pieces: PuzzlePiece[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * cw, y0 = r * ch, x1 = x0 + cw, y1 = y0 + ch;
      const top = r > 0 ? -H(r - 1, c) : 0;
      const right = c < cols - 1 ? V(r, c) : 0;
      const bottom = r < rows - 1 ? H(r, c) : 0;
      const left = c > 0 ? -V(r, c - 1) : 0;
      const d = `M${x0} ${y0} ${edge(x0, y0, x1, y0, top)} ${edge(x1, y0, x1, y1, right)} ${edge(x1, y1, x0, y1, bottom)} ${edge(x0, y1, x0, y0, left)} Z`;
      pieces.push({ id: r * cols + c, col: c, row: r, d, cx: x0 + cw / 2, cy: y0 + ch / 2 });
    }
  }
  return pieces;
}
