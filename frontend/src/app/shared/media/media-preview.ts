import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Motion, gsap, reducedMotion } from '../../core/motion';
import { MediaItem } from './media-item';
import { imagesOf, stepRole, videoOf } from './media-list';

/** Plays a sign's pictures in order (and its video) the way a learner will see them. */
@Component({
  selector: 'app-media-preview',
  standalone: true,
  templateUrl: './media-preview.html',
  styleUrl: './media-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaPreview implements OnDestroy {
  readonly items = input.required<MediaItem[]>();
  /** Starts stepping through the pictures by itself. */
  readonly autoplay = input(false);

  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly motion = new Motion(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
  private timer = 0;

  readonly pictures = computed(() => imagesOf(this.items()));
  readonly video = computed(() => videoOf(this.items()));
  /** Which picture is showing (0 is the start picture). */
  readonly index = signal(0);
  readonly playing = signal(false);
  /** Pictures or video, when the sign has both. */
  readonly tab = signal<'pictures' | 'video'>('pictures');
  readonly current = computed(() => this.pictures()[Math.min(this.index(), Math.max(0, this.pictures().length - 1))] ?? null);
  readonly role = computed(() => stepRole(this.index(), this.pictures().length));
  readonly roleLabel = { only: 'Picture', start: 'Start', next: 'Next', final: 'Final' };

  constructor() {
    // Whenever the list changes: go back to the start, and begin playing if asked to.
    effect(() => {
      this.pictures();
      this.index.set(0);
      this.stop();
      if (this.autoplay() && this.pictures().length > 1) this.play();
      if (!this.pictures().length && this.video()) this.tab.set('video');
    });
  }

  /** Shows picture `i` with a short slide-and-fade, in the direction of travel. */
  show(i: number): void {
    const n = this.pictures().length;
    if (!n) return;
    const next = (i + n) % n;
    const dir = next >= this.index() ? 1 : -1;
    this.index.set(next);
    const img = this.stage()?.nativeElement.querySelector('img');
    if (img && !reducedMotion()) this.motion.run(() => void gsap.fromTo(img, { opacity: 0, x: 24 * dir }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' }));
  }
  // Shows the next picture.
  next(): void { this.show(this.index() + 1); }
  // Shows the previous picture.
  prev(): void { this.show(this.index() - 1); }

  /** Steps to the next picture every 1.4 seconds, and stops at the end so the Final picture stays on screen. */
  play(): void {
    if (this.pictures().length < 2) return;
    this.stop();
    if (this.index() >= this.pictures().length - 1) this.index.set(0);
    this.playing.set(true);
    this.timer = window.setInterval(() => {
      if (this.index() >= this.pictures().length - 1) { this.stop(); return; }
      this.next();
    }, 1400);
  }
  // Stops the automatic stepping.
  stop(): void { clearInterval(this.timer); this.playing.set(false); }
  // Starts or stops the automatic stepping.
  toggle(): void { this.playing() ? this.stop() : this.play(); }

  // Stops playback and animations when the preview is destroyed.
  ngOnDestroy(): void { this.stop(); this.motion.destroy(); }
}
