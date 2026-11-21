/** Tracks progress through a target string: letters, spaces, and repeated-letter rules. */
export class SequenceBuilder {
  private pos = 0;
  // Remembers the target string (single spaces between words).
  constructor(readonly target: string) {}

  // The part of the target signed so far.
  get built(): string { return this.target.slice(0, this.pos); }
  // True when every character of the target has been signed.
  get done(): boolean { return this.pos >= this.target.length; }
  // How many characters of the target are done.
  get position(): number { return this.pos; }
  // The next character needed, or null when finished.
  expected(): string | null { return this.done ? null : this.target[this.pos]; }
  /** True when the next thing needed is the Space button. */
  get needsSpace(): boolean { return this.expected() === ' '; }
  // How many complete words have been signed so far.
  get wordsDone(): number { return this.built.split(' ').filter(Boolean).length - (this.built.endsWith(' ') || this.done ? 0 : 1); }
  // How many words the target has in total.
  get wordCount(): number { return this.target.split(' ').length; }

  // Accepts a confirmed letter when it is the one expected next.
  accept(letter: string): boolean {
    if (this.expected() !== letter) return false;
    this.pos++;
    return true;
  }
  // Accepts the Space button when a space is what is needed next.
  pressSpace(): boolean {
    if (!this.needsSpace) return false;
    this.pos++;
    return true;
  }
  // Starts the sequence over from the first character.
  reset(): void { this.pos = 0; }
}
