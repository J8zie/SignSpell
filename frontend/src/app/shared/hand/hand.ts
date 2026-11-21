import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type Pt = readonly [number, number];
export type HandState = 'ok' | 'bad' | 'idle';

// 21 hand landmarks in MediaPipe order, letter B. GOOD is the correct sign; BAD has the thumb out and fingers spread.
export const GOOD: readonly Pt[] = [
  [100, 225], [82, 205], [86, 182], [96, 168], [108, 160],
  [80, 140], [80, 100], [80, 72], [80, 48],
  [98, 134], [98, 92], [98, 62], [98, 36],
  [116, 138], [116, 98], [116, 70], [116, 46],
  [133, 148], [134, 116], [134, 94], [134, 74],
];
const WRONG: Record<number, Pt> = {
  1: [70, 205], 2: [52, 182], 3: [38, 160], 4: [26, 140],
  6: [66, 102], 7: [58, 76], 8: [50, 52],
  18: [148, 118], 19: [158, 96], 20: [166, 76],
};
export const BAD: readonly Pt[] = GOOD.map((p, i): Pt => WRONG[i] ?? p);
export const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17],
];

/** The 21-point hand skeleton. Green when ok, red (with the wrong pose) when bad, neutral when idle. */
@Component({
  selector: 'app-hand',
  standalone: true,
  host: { '[attr.data-state]': 'state()' },
  template: `
    <svg viewBox="0 0 200 250" aria-hidden="true">
      @for (e of edges; track $index) {
        <line [attr.x1]="points()[e[0]][0]" [attr.y1]="points()[e[0]][1]" [attr.x2]="points()[e[1]][0]" [attr.y2]="points()[e[1]][1]" />
      }
      @for (p of points(); track $index) {
        <circle [attr.cx]="p[0]" [attr.cy]="p[1]" r="3.6" />
      }
    </svg>`,
  styles: `
    :host { display: block; --hs: var(--fg); box-sizing: border-box; }
    :host([data-state='ok']) { --hs: var(--ok); }
    :host([data-state='bad']) { --hs: var(--bad); }
    svg { display: block; width: 100%; height: 100%; }
    line { stroke: var(--hs); stroke-width: 2.4; stroke-linecap: round; transition: stroke 0.5s; }
    circle { fill: var(--hs); transition: fill 0.5s; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hand {
  readonly state = input<HandState>('ok');
  // Picks the good or bad pose depending on the hand state.
  readonly points = computed(() => (this.state() === 'bad' ? BAD : GOOD));
  readonly edges = EDGES;
}
