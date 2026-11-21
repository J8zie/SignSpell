import { ChangeDetectionStrategy, Component, ElementRef, Injector, OnDestroy, afterNextRender, afterRenderEffect, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Flip, Motion, gsap, reducedMotion } from '../../core/motion';
import { MediaItem } from './media-item';
import { imagesOf, makeStart, moveImage, removeItem, stepRole } from './media-list';

/** Shows a sign's pictures as an ordered, reorderable sequence of numbered steps. */
@Component({
  selector: 'app-media-sequence',
  standalone: true,
  templateUrl: './media-sequence.html',
  styleUrl: './media-sequence.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaSequence implements OnDestroy {
  /** All media of the sign. Only the pictures are drawn here; a video is shown elsewhere. */
  readonly items = input.required<MediaItem[]>();
  /** False shows the sequence read-only (no buttons, no dragging), for example in a preview. */
  readonly editable = input(true);
  /** Reported with the NEW list whenever the teacher reorders or removes a picture. */
  readonly itemsChange = output<MediaItem[]>();
  /** Reported with the id of a picture the teacher removed, so the parent can free its temporary address. */
  readonly removed = output<MediaItem>();

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private readonly injector = inject(Injector);
  private readonly motion = new Motion(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
  private seen = new Set<string>();

  readonly pictures = computed(() => imagesOf(this.items()));
  /** The picture being dragged right now, and the card it is hovering over (to draw a drop marker). */
  readonly dragId = signal<string | null>(null);
  readonly overId = signal<string | null>(null);

  readonly roleOf = (i: number): 'only' | 'start' | 'next' | 'final' => stepRole(i, this.pictures().length);
  readonly roleLabel = { only: 'Only picture', start: 'Start', next: 'Next', final: 'Final' };

  constructor() {
    // New pictures pop in. (Reordering is animated separately with Flip, so only genuinely new cards are handled here.)
    afterRenderEffect(() => {
      const ids = this.pictures().map((p) => p.id);
      const fresh = (this.list()?.nativeElement.querySelectorAll<HTMLElement>('.step') ?? []);
      const added = Array.from(fresh).filter((_, i) => !this.seen.has(ids[i]));
      this.seen = new Set(ids);
      if (added.length && !reducedMotion()) this.motion.run(() => void gsap.from(added, { opacity: 0, scale: 0.85, y: 10, duration: 0.45, ease: 'back.out(1.7)', stagger: 0.07, clearProps: 'opacity,transform' }));
    });
  }

  /** Emits the new list, animating the cards from their old positions to the new ones. */
  private apply(next: MediaItem[]): void {
    const cards = this.list()?.nativeElement.querySelectorAll('.step');
    const state = cards && !reducedMotion() ? Flip.getState(cards) : null;
    this.itemsChange.emit(next);
    if (state) afterNextRender(() => Flip.from(state, { duration: 0.45, ease: 'power2.inOut' }), { injector: this.injector });
  }

  // Moves a picture earlier or later in the sequence.
  move(item: MediaItem, by: number): void {
    const from = this.pictures().findIndex((p) => p.id === item.id);
    this.apply(moveImage(this.items(), item.id, from + by));
  }
  // Makes a picture the first step (the start image).
  makeStart(item: MediaItem): void { this.apply(makeStart(this.items(), item.id)); }
  // Removes a picture from the sequence.
  remove(item: MediaItem): void { this.removed.emit(item); this.itemsChange.emit(removeItem(this.items(), item.id)); }

  // ---------- drag and drop (mouse and trackpad) ----------
  // Starts dragging a picture card.
  dragStart(e: DragEvent, item: MediaItem): void {
    if (!this.editable()) return;
    this.dragId.set(item.id);
    e.dataTransfer?.setData('text/plain', item.id); // Firefox needs some data to start a drag
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }
  // Marks the card being hovered as a drop target.
  dragOver(e: DragEvent, item: MediaItem): void {
    if (!this.dragId()) return;
    e.preventDefault(); // tells the browser this card accepts a drop
    this.overId.set(item.id);
  }
  // Drops the dragged picture onto the target card's position.
  drop(e: DragEvent, target: MediaItem): void {
    e.preventDefault();
    const id = this.dragId();
    this.dragEnd();
    if (!id || id === target.id) return;
    this.apply(moveImage(this.items(), id, this.pictures().findIndex((p) => p.id === target.id)));
  }
  // Clears the drag state when dragging ends.
  dragEnd(): void { this.dragId.set(null); this.overId.set(null); }

  // Stops animations when the sequence is destroyed.
  ngOnDestroy(): void { this.motion.destroy(); }
}
