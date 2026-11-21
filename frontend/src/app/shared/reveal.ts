import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { Motion, gsap, reducedMotion, riseIn } from '../core/motion';

/** Directive that fades and rises in an element's children, including ones added later. */
@Directive({ selector: '[appReveal]', standalone: true })
export class Reveal implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private motion?: Motion;
  private watcher?: MutationObserver;

  // Animates existing children, then watches for new ones.
  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    this.motion = new Motion(el);
    // Animate what is already there...
    this.play(Array.from(el.children));
    // ...and anything the page adds later.
    if (reducedMotion()) return;
    this.watcher = new MutationObserver((records) => {
      const added = records.flatMap((r) => Array.from(r.addedNodes)).filter((n): n is HTMLElement => n instanceof HTMLElement);
      if (added.length) this.play(added);
    });
    this.watcher.observe(el, { childList: true });
  }

  // Fades and lifts a set of elements in one after another.
  private play(targets: Element[]): void {
    if (!targets.length || reducedMotion()) return;
    gsap.set(targets, { opacity: 0 }); // hide at once so nothing flashes before the animation starts
    this.motion?.run(() => void riseIn(targets));
  }

  // Stops watching and undoes all animations.
  ngOnDestroy(): void {
    this.watcher?.disconnect();
    this.motion?.destroy(); // stops and undoes every animation this directive started
  }
}
