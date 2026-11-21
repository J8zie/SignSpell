import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Magnetic } from '../../shared/magnetic';
import { Hand } from '../../shared/hand/hand';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [Magnetic, Hand, RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hero implements OnInit, OnDestroy {
  /** Becomes true when the intro curtain opens. */
  readonly play = input(false);
  readonly state = signal<'bad' | 'ok'>('bad');
  readonly lines = ['Spell with your hands.', 'Get checked in real time.'];
  private timer = 0;

  ngOnInit(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.state.set('ok');
      return;
    }
    this.timer = window.setInterval(() => this.state.update((s) => (s === 'bad' ? 'ok' : 'bad')), 3200);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
