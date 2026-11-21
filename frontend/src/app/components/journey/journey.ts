import { Hand, HandState } from '../../shared/hand/hand';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, signal, viewChild } from '@angular/core';

interface Step { hand: HandState; glyph: string; chip: string; title: string; text: string; img: string; }

/**
 * Vertical scroll drives a horizontal track (sticky pin + translateX). The page never traps
 * the wheel or touch: native scrolling is untouched, so it stays usable on phones and tablets.
 */
@Component({
  selector: 'app-journey',
  standalone: true,
  imports: [Hand],
  templateUrl: './journey.html',
  styleUrl: './journey.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Journey implements AfterViewInit, OnDestroy {
  readonly steps: Step[] = [
    { hand: 'idle', glyph: '21', chip: 'hand points, found in your browser', title: 'Find your hand', img: 'step-1.jpg',
      text: 'MediaPipe finds your palm, then 21 points on your hand. It runs inside your browser, so your video never leaves your device.' },
    { hand: 'idle', glyph: '0·0', chip: 'the wrist is the starting point', title: 'Make every hand equal', img: 'step-2.jpg',
      text: 'The wrist becomes the origin, points are scaled by palm size and a left hand is mirrored. Hand size and distance stop mattering.' },
    { hand: 'ok', glyph: 'A', chip: 'points in, letter out', title: 'Read the letter', img: 'step-3.jpg',
      text: 'A small neural network, trained on free ASL alphabet datasets and volunteer samples, turns the normalized points into a letter.' },
    { hand: 'bad', glyph: 'M N', chip: 'A, M, N, S and T look alike', title: 'Tell look-alikes apart', img: 'step-4.jpg',
      text: 'Rules on thumb and fingertip positions separate A, M, N, S and T. J and Z are checked from the path your fingertip draws.' },
    { hand: 'ok', glyph: '1s', chip: 'green or red, no flicker', title: 'Hold it for one second', img: 'step-5.jpg',
      text: 'A letter is confirmed only when it wins the vote over about one second of frames, so feedback does not flip between green and red.' },
    { hand: 'ok', glyph: 'HELLO', chip: 'letters join into words', title: 'Build words and sentences', img: 'step-6.jpg',
      text: 'Confirmed letters join into a word. The Space button starts a new word, up to five words. Only each result (letter, correct or wrong, date) is saved to your account.' },
  ];

  readonly progress = signal(0);
  readonly pinned = signal(true);
  readonly active = signal(0);

  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly pin = viewChild.required<ElementRef<HTMLElement>>('pin');
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private maxX = 0;
  private raf = 0;
  private ro?: ResizeObserver;
  private readonly onScroll = () => {
    if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.update(); });
  };

  ngAfterViewInit(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.pinned.set(false); // stacked layout, no scroll-linked motion
      return;
    }
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this.pin().nativeElement);
    this.ro.observe(this.track().nativeElement);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.measure();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    this.ro?.disconnect();
    cancelAnimationFrame(this.raf);
  }

  goTo(i: number): void {
    const n = this.steps.length;
    const clamped = Math.max(0, Math.min(n - 1, i));
    const top = this.root().nativeElement.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (clamped / (n - 1)) * this.maxX, behavior: 'smooth' });
  }

  private measure(): void {
    const pin = this.pin().nativeElement;
    this.maxX = Math.max(0, this.track().nativeElement.scrollWidth - pin.clientWidth);
    this.root().nativeElement.style.height = `${pin.clientHeight + this.maxX}px`;
    this.update();
  }

  private update(): void {
    const top = this.root().nativeElement.getBoundingClientRect().top;
    const p = this.maxX ? Math.min(1, Math.max(0, -top / this.maxX)) : 0;
    this.progress.set(p);
    const mid = this.pin().nativeElement.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    Array.from(this.track().nativeElement.children).forEach((el, i) => {
      const c = (el as HTMLElement).offsetLeft + (el as HTMLElement).offsetWidth / 2 - p * this.maxX;
      if (Math.abs(c - mid) < bestDist) { bestDist = Math.abs(c - mid); best = i; }
    });
    this.active.set(best);
  }

  x(): number {
    return this.progress() * this.maxX;
  }
}
