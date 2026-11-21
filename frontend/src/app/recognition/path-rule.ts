export interface PathPoint { x: number; y: number; t: number; }

/** Douglas-Peucker: keeps only the corners of a path. */
function simplify(pts: PathPoint[], eps: number): PathPoint[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((b.x - a.x) * (a.y - pts[i].y) - (a.x - pts[i].x) * (b.y - a.y)) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}

/** Recognizes the drawn letters J and Z from a path of fingertip positions. */
export function classifyPath(points: PathPoint[]): 'J' | 'Z' | null {
  if (points.length < 6) return null;
  const v = simplify(points, 0.12);
  const segs = v.slice(1).map((p, i) => ({ dx: p.x - v[i].x, dy: p.y - v[i].y })).filter((s) => Math.hypot(s.dx, s.dy) > 0.2);
  const total = segs.reduce((s, g) => s + Math.hypot(g.dx, g.dy), 0);
  if (segs.length < 2 || total < 1) return null;
  const turn = (a: { dx: number; dy: number }, b: { dx: number; dy: number }) => Math.atan2(a.dx * b.dy - a.dy * b.dx, a.dx * b.dx + a.dy * b.dy) * 180 / Math.PI;
  const turns = segs.slice(1).map((s, i) => turn(segs[i], s));
  if (segs.length === 2 && Math.abs(segs[0].dy) > Math.abs(segs[0].dx) && segs[0].dy > 0 && Math.abs(turns[0]) >= 50 && Math.abs(turns[0]) <= 160) return 'J';
  if (segs.length === 3 && Math.abs(segs[0].dx) > Math.abs(segs[0].dy) && turns.every((x) => Math.abs(x) >= 100) && Math.sign(turns[0]) !== Math.sign(turns[1])) return 'Z'; // a Z zigzags, so the two turns go opposite ways
  return null;
}
