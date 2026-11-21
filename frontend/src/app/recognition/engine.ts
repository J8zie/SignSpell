import { FrameVoter, Vote } from './frame-voter';
import { SequenceBuilder } from './sequence-builder';
import { SignType } from '../core/models';

export interface Seen { label: string | null; confidence: number; }
export type EngineEvent =
  | { type: 'correct'; label: string; confidence: number; complete: boolean }
  | { type: 'wrong'; label: string; expected: string; confidence: number };
export interface Tick { vote: Vote; live: string | null; event: EngineEvent | null; }

export const RELEASE_MS = 250;
export const LIMIT_MS: Record<SignType, number> = { letter: 0, word: 60_000, sentence: 180_000 };

/** Runs one practice round: votes over recent frames, then reports correct or wrong per sign. */
export class PracticeEngine {
  readonly voter = new FrameVoter();
  readonly builder: SequenceBuilder;
  private locked: string | null = null;
  private releaseAt: number | null = null;
  private finished = false;

  // Sets up the vote counter and the letter/word/sentence tracker for this round.
  constructor(readonly target: string, readonly mode: SignType) {
    this.builder = new SequenceBuilder(mode === 'letter' ? target[0] : target);
  }

  // True once the whole target (letter, word, or sentence) has been signed.
  get done(): boolean { return this.finished; }

  // Processes one camera frame and returns the vote, live label, and any confirmed event.
  step(t: number, seen: Seen | null): Tick {
    const label = seen?.label ?? null;
    const vote = this.voter.push(t, label, seen?.confidence ?? 0);
    if (this.locked !== null) {
      if (label !== this.locked) {
        this.releaseAt ??= t;
        if (t - this.releaseAt >= RELEASE_MS) {
          // The hand changed or left. Drop the old frames (they still vote for the old sign) and start fresh.
          this.locked = null; this.releaseAt = null; this.voter.reset();
          return { vote: this.voter.push(t, label, seen?.confidence ?? 0), live: label, event: null };
        }
      } else this.releaseAt = null;
    }
    if (this.finished || this.locked !== null || !vote.confirmed || !vote.candidate) return { vote, live: label, event: null };

    const got = vote.candidate;
    const expected = this.builder.expected();
    if (expected === null || this.builder.needsSpace) return { vote, live: label, event: null }; // waiting for Space
    this.locked = got;
    this.releaseAt = null;
    if (this.builder.accept(got)) {
      this.finished = this.builder.done;
      return { vote, live: label, event: { type: 'correct', label: got, confidence: vote.confidence, complete: this.finished } };
    }
    return { vote, live: label, event: { type: 'wrong', label: got, expected, confidence: vote.confidence } };
  }

  /** The on-screen Space button. Returns false when a space is not what is needed next. */
  pressSpace(): boolean {
    const ok = this.builder.pressSpace();
    if (ok) { this.locked = null; this.releaseAt = null; this.voter.reset(); }
    return ok;
  }

  // Starts the round over with a fresh vote and sequence.
  reset(): void {
    this.builder.reset();
    this.voter.reset();
    this.locked = null; this.releaseAt = null; this.finished = false;
  }
}
