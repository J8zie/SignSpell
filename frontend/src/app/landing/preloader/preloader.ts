import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, output, signal } from '@angular/core';
import { Wordmark } from '../../shared/wordmark/wordmark';

/** Brief intro animation shown once per session; click or any key skips it. */
@Component({
  selector: 'app-preloader',
  standalone: true,
  imports: [Wordmark],
  templateUrl: './preloader.html',
  styleUrl: './preloader.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** Landing preloader component. */
export class Preloader implements OnInit, OnDestroy {
  readonly finished = output<void>();
  readonly leaving = signal(false);
  readonly hidden = signal(false);
  private timers: number[] = [];
  private skipped = false;

  // Starts the leave timers, faster when reduced motion is on.
  ngOnInit(): void {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.leaveIn(reduced ? 60 : 450);
  }

  // Skips the intro immediately.
  @HostListener('window:keydown')
  @HostListener('click')
  skip(): void {
    if (this.skipped || this.leaving()) return;
    this.skipped = true;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.leaveIn(0);
  }

  // Schedules the curtain to start leaving, then to hide.
  private leaveIn(wait: number): void {
    this.timers.push(
      window.setTimeout(() => { this.leaving.set(true); this.finished.emit(); }, wait),
      window.setTimeout(() => this.hidden.set(true), wait + 340),
    );
  }

  ngOnDestroy(): void { this.timers.forEach(clearTimeout); }
}
