import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, afterRenderEffect, computed, inject, input, output, viewChild } from '@angular/core';
import { Motion, gsap, reducedMotion } from '../../core/motion';
import { TimelineNode } from './timeline-node';
import { TimelineItem } from './timeline-items';

/** The key used for the optional first dot that means "no date chosen, show everything". */
export const ALL_KEY = '__all';

/** Dot timeline of dates that have data; the parent supplies dots and hears picks. */
@Component({
  selector: 'app-date-timeline',
  standalone: true,
  imports: [TimelineNode],
  templateUrl: './date-timeline.html',
  styleUrl: './date-timeline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateTimeline implements OnDestroy {
  /** The dates that have data, oldest first. */
  readonly items = input.required<TimelineItem[]>();
  /** The key of the chosen dot, or null for "all". */
  readonly selected = input<string | null>(null);
  /** Text of the first "everything" dot. Pass null to leave that dot out. */
  readonly allLabel = input<string | null>('All time');
  /** Describes the timeline for screen readers. */
  readonly ariaLabel = input('Dates with activity');
  /** Reported when the person picks a dot (the key), or the "all" dot (null). */
  readonly selectedChange = output<string | null>();

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  // Owns every animation this timeline starts, so they are all stopped and undone when it is destroyed.
  private readonly motion = new Motion(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
  private seen = new Set<string>();
  private lastSelected: string | undefined;

  /** The dots to draw: the optional "all" dot followed by the real dates. */
  readonly nodes = computed<TimelineItem[]>(() => {
    const all = this.allLabel();
    return all ? [{ key: ALL_KEY, label: all }, ...this.items()] : this.items();
  });
  /** Position of the chosen dot in `nodes`. */
  readonly selectedIndex = computed(() => Math.max(0, this.nodes().findIndex((n) => n.key === (this.selected() ?? ALL_KEY))));

  constructor() {
    // After every render: pop in dots that are new, and give the chosen dot a little bounce and scroll it into view.
    afterRenderEffect(() => {
      const track = this.track().nativeElement;
      const keys = this.nodes().map((n) => n.key);
      const chosen = this.selected() ?? ALL_KEY;
      const buttons = Array.from(track.querySelectorAll<HTMLElement>('.node'));

      const fresh = buttons.filter((_, i) => !this.seen.has(keys[i]));
      this.seen = new Set(keys);
      if (fresh.length && !reducedMotion()) {
        this.motion.run(() => void gsap.from(fresh.map((b) => b.querySelector('.dot')), { scale: 0, opacity: 0, duration: 0.45, ease: 'back.out(2.2)', stagger: 0.05 }));
      }

      if (this.lastSelected !== undefined && this.lastSelected !== chosen) {
        const dot = buttons[keys.indexOf(chosen)]?.querySelector('.dot');
        if (dot && !reducedMotion()) this.motion.run(() => void gsap.fromTo(dot, { y: -6 }, { y: 0, duration: 0.55, ease: 'elastic.out(1, 0.45)' }));
      }
      // Keep the chosen dot visible: matters when many dots do not fit and the track scrolls sideways.
      buttons[keys.indexOf(chosen)]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reducedMotion() || this.lastSelected === undefined ? 'auto' : 'smooth' });
      this.lastSelected = chosen;
    });
  }

  /** Reports a pick. The "all" dot is reported as null so the parent does not need to know about ALL_KEY. */
  choose(key: string): void { this.selectedChange.emit(key === ALL_KEY ? null : key); }

  /** Arrow keys, Home and End move the choice (a "radio group" keyboard pattern). */
  onKey(e: KeyboardEvent): void {
    const n = this.nodes().length;
    const i = this.selectedIndex();
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0 || next >= n || next === i) return;
    e.preventDefault();
    this.choose(this.nodes()[next].key);
    // Move the keyboard focus along with the choice, once the new dot has become the focusable one.
    queueMicrotask(() => requestAnimationFrame(() => this.track().nativeElement.querySelectorAll<HTMLElement>('.node')[next]?.focus()));
  }

  // Stops all running animations when the timeline is destroyed.
  ngOnDestroy(): void { this.motion.destroy(); }
}
