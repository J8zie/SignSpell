import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Hand } from '../hand/hand';
import { Wordmark } from '../wordmark/wordmark';

/** The left panel of the sign-in pages: logo, promise, and the red/green hand that shows what the app does. */
@Component({
  selector: 'app-auth-brand',
  standalone: true,
  imports: [RouterLink, Hand, Wordmark],
  templateUrl: './auth-brand.html',
  styleUrl: './auth-brand.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthBrand implements OnInit, OnDestroy {
  readonly state = signal<'bad' | 'ok'>('bad');
  private timer = 0;
  // Starts flipping the hand between red and green (static green when reduced motion is on).
  ngOnInit(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { this.state.set('ok'); return; }
    this.timer = window.setInterval(() => this.state.update((s) => (s === 'bad' ? 'ok' : 'bad')), 2800);
  }
  // Stops the flipping timer when the page is left.
  ngOnDestroy(): void { clearInterval(this.timer); }
}
