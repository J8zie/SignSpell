/** The one place screens read and write teacher hints; the HTTP implementation talks to the Laravel API. */
export abstract class HintRepository {
  /** The hint for one sign, or null when the teacher did not write one. */
  abstract get(signId: string): Promise<string | null>;
  /** Every known hint, by sign id. Used to show a small "has a hint" badge in lists. */
  abstract getAll(): Promise<Record<string, string>>;
  /** Creates or replaces the hint of a sign. */
  abstract save(signId: string, text: string): Promise<void>;
  /** Removes the hint of a sign. */
  abstract remove(signId: string): Promise<void>;
}
