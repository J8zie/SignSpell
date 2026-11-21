import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, output, signal } from '@angular/core';

/**
 * Intro: the app "spells" SIGNSPELL the way a learner would. The first tile flashes red
 * (wrong sign + hint), then every tile turns green as it is confirmed. The counter is the
 * hold-steady progress.
 */
@Component({
  selector: 'app-preloader',
  standalone: true,
  templateUrl: './preloader.html',
  styleUrl: './preloader.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Preloader implements OnInit, OnDestroy {
  readonly finished = output<void>();
  readonly letters = 'SIGNSPELL'.split('');
  readonly progress = signal(0);
  readonly leaving = signal(false);
  readonly hidden = signal(false);

  readonly filled = computed(() => Math.min(this.letters.length, Math.floor(this.progress() / (100 / this.letters.length))));
  readonly count = computed(() => String(Math.round(this.progress())).padStart(3, '0'));
  readonly status = computed(() => {
    const p = this.progress();
    if (p < 4) return 'Looking for your hand…';
    if (p < 11) return 'Red: wrong sign. Hint: make a fist and cross your thumb over your fingers.';
    if (p < 100) return `Green: ${this.filled()} of ${this.letters.length} letters confirmed. Hold steady.`;
    return 'Spelled it. Let’s learn.';
  });

  private raf = 0;
  private timers: number[] = [];
  private skipped = false;

  ngOnInit(): void {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const total = reduced ? 400 : 3600;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / total);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.progress.set(100 * eased);
      if (t < 1) {
        this.raf = requestAnimationFrame(tick);
      } else {
        this.finish(450);
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Lets keyboard and screen-reader users skip the intro. */
  skip(): void {
    if (this.leaving() || this.skipped) return;
    cancelAnimationFrame(this.raf);
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.progress.set(100);
    this.finish(150);
  }

  private finish(wait: number): void {
    this.skipped = true;
    this.timers.push(
      window.setTimeout(() => this.leaving.set(true), wait),
      window.setTimeout(() => this.finished.emit(), wait + 350),
      window.setTimeout(() => this.hidden.set(true), wait + 1050),
    );
  }

  stateOf(i: number): 'ok' | 'bad' | 'hold' | 'idle' {
    const f = this.filled();
    if (i < f) return 'ok';
    if (i === f) return i === 0 && this.progress() >= 4 ? 'bad' : 'hold';
    return 'idle';
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.timers.forEach(clearTimeout);
  }
}
