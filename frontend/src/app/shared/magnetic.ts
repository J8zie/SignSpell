import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/** Pulls a link or button slightly toward the cursor. Mouse only; skipped on touch and reduced motion. */
@Directive({ selector: '[appMagnetic]', standalone: true, host: { '[style.transition]': '"transform .25s ease"' } })
export class Magnetic {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly enabled =
    matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Slides the element toward the mouse pointer.
  @HostListener('pointermove', ['$event'])
  move(e: PointerEvent): void {
    if (!this.enabled || e.pointerType !== 'mouse') return;
    const r = this.el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * 0.22;
    const y = (e.clientY - (r.top + r.height / 2)) * 0.3;
    this.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  // Springs the element back when the pointer leaves.
  @HostListener('pointerleave')
  leave(): void {
    this.el.style.transform = '';
  }
}
