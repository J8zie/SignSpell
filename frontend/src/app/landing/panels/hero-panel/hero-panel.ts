import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Magnetic } from '../../../shared/magnetic';
import { Wordmark } from '../../../shared/wordmark/wordmark';
import { HERO } from '../../content';

/** Landing hero panel with the wordmark, tagline, and a flipping ok/bad status demo. */
@Component({
  selector: 'app-hero-panel',
  standalone: true,
  imports: [RouterLink, Magnetic, Wordmark],
  templateUrl: './hero-panel.html',
  styleUrl: './hero-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** Landing hero panel component. */
export class HeroPanel implements OnInit, OnDestroy {
  /** True once the intro curtain opens, so the wordmark and the text can build up. */
  readonly play = input(false);
  readonly hero = HERO;
  /** The little status line flips between a wrong and a right sign, like the real app does. */
  readonly state = signal<'bad' | 'ok'>('bad');
  private timer = 0;
  // Starts the ok/bad status flip unless reduced motion is on.
  ngOnInit(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { this.state.set('ok'); return; }
    this.timer = window.setInterval(() => this.state.update((s) => (s === 'bad' ? 'ok' : 'bad')), 2600);
  }
  // Stops the status flip timer.
  ngOnDestroy(): void { clearInterval(this.timer); }
}
