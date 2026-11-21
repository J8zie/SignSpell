export interface Vote { candidate: string | null; share: number; progress: number; confirmed: boolean; confidence: number; }

/** Confirms a sign only when one label wins the vote across about the last second of frames. */
export class FrameVoter {
  private frames: { t: number; label: string | null; conf: number }[] = [];
  // windowMs = how far back frames count; minShare/minFrames = how steady the winner must be.
  constructor(readonly windowMs = 1000, private minShare = 0.7, private minFrames = 4) {}

  // Adds one frame's guess and returns the current vote result.
  push(t: number, label: string | null, conf: number): Vote {
    this.frames.push({ t, label, conf });
    while (this.frames.length && t - this.frames[0].t > this.windowMs) this.frames.shift();
    const counts = new Map<string, number>();
    for (const f of this.frames) if (f.label) counts.set(f.label, (counts.get(f.label) ?? 0) + 1);
    const [winner, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const share = this.frames.length ? count / this.frames.length : 0;
    const span = t - this.frames[0].t;
    const steady = !!winner && share >= this.minShare;
    const progress = steady ? Math.min(1, span / (this.windowMs * 0.9)) : 0;
    const confirmed = steady && span >= this.windowMs * 0.9 && this.frames.length >= this.minFrames;
    const wins = this.frames.filter((f) => f.label === winner);
    const confidence = wins.length ? wins.reduce((s, f) => s + f.conf, 0) / wins.length : 0;
    return { candidate: winner, share, progress, confirmed, confidence };
  }

  // Clears all remembered frames (used when the hand changes or the round restarts).
  reset(): void { this.frames = []; }
}
