import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, signal, viewChild } from '@angular/core';

interface Letter { l: string; cue: string; kind?: 'look-alike' | 'motion'; }

const LETTERS: Letter[] = [
  { l: 'A', cue: 'Fist with the thumb along the side', kind: 'look-alike' },
  { l: 'B', cue: 'Flat hand, fingers together, thumb across the palm' },
  { l: 'C', cue: 'Curve your hand into a C' },
  { l: 'D', cue: 'Index finger up, other fingers touch the thumb' },
  { l: 'E', cue: 'Fingers bent down, thumb tucked underneath' },
  { l: 'F', cue: 'Thumb and index touch, other three fingers up' },
  { l: 'G', cue: 'Index finger and thumb point sideways' },
  { l: 'H', cue: 'Index and middle fingers point sideways together' },
  { l: 'I', cue: 'Fist with the pinky up' },
  { l: 'J', cue: 'Pinky up, then draw a J in the air', kind: 'motion' },
  { l: 'K', cue: 'Index and middle up in a V, thumb between them' },
  { l: 'L', cue: 'Index finger up and thumb out, like an L' },
  { l: 'M', cue: 'Thumb tucked under three fingers', kind: 'look-alike' },
  { l: 'N', cue: 'Thumb tucked under two fingers', kind: 'look-alike' },
  { l: 'O', cue: 'Fingers and thumb curve to touch, like an O' },
  { l: 'P', cue: 'Like K, pointing down' },
  { l: 'Q', cue: 'Like G, pointing down' },
  { l: 'R', cue: 'Index and middle fingers crossed' },
  { l: 'S', cue: 'Fist with the thumb across the front of the fingers', kind: 'look-alike' },
  { l: 'T', cue: 'Fist with the thumb between index and middle', kind: 'look-alike' },
  { l: 'U', cue: 'Index and middle fingers up together' },
  { l: 'V', cue: 'Index and middle fingers up and apart' },
  { l: 'W', cue: 'Index, middle and ring fingers up and apart' },
  { l: 'X', cue: 'Index finger hooked' },
  { l: 'Y', cue: 'Thumb and pinky out' },
  { l: 'Z', cue: 'Draw a Z in the air with your index finger', kind: 'motion' },
];

@Component({
  selector: 'app-guide',
  standalone: true,
  templateUrl: './guide.html',
  styleUrl: './guide.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Guide implements OnDestroy {
  readonly query = signal('');
  readonly selected = signal('A');
  readonly list = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return LETTERS;
    // One character searches the letter itself; longer text searches the hand-shape hint.
    return q.length === 1 ? LETTERS.filter((x) => x.l.toLowerCase() === q) : LETTERS.filter((x) => x.cue.toLowerCase().includes(q));
  });
  readonly current = computed(() => LETTERS.find((x) => x.l === this.selected()) ?? LETTERS[0]);

  /** Floating preview that trails the mouse with a little lag. Not used on touch screens. */
  readonly showFollow = signal(false);
  private readonly follow = viewChild<ElementRef<HTMLElement>>('follow');
  private readonly fine = matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  private tx = 0; private ty = 0; private cx = 0; private cy = 0; private raf = 0;

  onMove(e: PointerEvent): void {
    if (!this.fine || e.pointerType !== 'mouse') return;
    this.tx = e.clientX + 230 > innerWidth ? e.clientX - 230 : e.clientX + 18;
    this.ty = e.clientY + 18;
    if (!this.showFollow()) { this.cx = this.tx; this.cy = this.ty; this.showFollow.set(true); }
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  onLeave(): void {
    this.showFollow.set(false);
  }

  private readonly loop = () => {
    this.cx += (this.tx - this.cx) * 0.18;
    this.cy += (this.ty - this.cy) * 0.18;
    const el = this.follow()?.nativeElement;
    if (el) el.style.transform = `translate3d(${this.cx}px, ${this.cy}px, 0)`;
    this.raf = this.showFollow() ? requestAnimationFrame(this.loop) : 0;
  };

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
  }

  onSearch(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    const first = this.list()[0];
    if (first) this.selected.set(first.l);
  }

  pick(l: string): void {
    this.selected.set(l);
  }
}
