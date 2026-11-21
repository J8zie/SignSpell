import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';
import { EASE, gsap, reducedMotion } from '../../core/motion';

/** Collapsible panel that shows the hint text; it slides open and stays hidden from screen readers when closed. */
@Component({
  selector: 'app-hint-panel',
  standalone: true,
  template: `
    <div class="wrap" #wrap [attr.id]="panelId()" [attr.aria-hidden]="!open()" [attr.inert]="open() ? null : ''" role="note">
      <p class="text">{{ text() }}</p>
    </div>`,
  styles: `
    :host { display: block; }
    .wrap { height: 0; opacity: 0; overflow: hidden; }
    .text { margin: 0; padding: 0.7rem 1rem; border-left: 3px solid var(--fg); border-radius: 0 12px 12px 0; background: var(--surface); font-size: 0.95rem; line-height: 1.5; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HintPanel {
  /** The hint the teacher wrote. */
  readonly text = input('');
  /** True while the hint is showing. */
  readonly open = input(false);
  /** Lets a button point at this panel with aria-controls. */
  readonly panelId = input<string | null>(null);
  private readonly wrap = viewChild.required<ElementRef<HTMLElement>>('wrap');
  private first = true;

  constructor() {
    // Slide to the right height whenever it opens or closes (the very first run just sets the starting state).
    afterRenderEffect(() => {
      const el = this.wrap().nativeElement;
      const open = this.open();
      const instant = this.first || reducedMotion();
      this.first = false;
      gsap.killTweensOf(el);
      if (instant) { gsap.set(el, { height: open ? 'auto' : 0, opacity: open ? 1 : 0 }); return; }
      gsap.to(el, { height: open ? 'auto' : 0, opacity: open ? 1 : 0, duration: open ? 0.4 : 0.25, ease: open ? EASE : 'power2.in' });
    });
  }
}
