import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/** Directive that measures the chosen child and exposes its position/size to CSS for a sliding pill. */
@Directive({ selector: '[appSlider]', standalone: true })
export class Slider implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private mutations?: MutationObserver;
  private sizes?: ResizeObserver;

  // Measures now and re-measures whenever choices, sizes, or fonts change.
  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    this.measure();
    this.mutations = new MutationObserver(() => this.measure());
    this.mutations.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'class', 'aria-current'] });
    if (typeof ResizeObserver !== 'undefined') { this.sizes = new ResizeObserver(() => this.measure()); this.sizes.observe(el); }
    // Fonts arriving later change the widths.
    void document.fonts?.ready.then(() => this.measure());
  }

  // Finds the chosen child and writes its position and size as CSS variables.
  private measure(): void {
    const el = this.host.nativeElement;
    const on = el.querySelector<HTMLElement>('[aria-pressed="true"], .on, [aria-current="page"]');
    if (!on || !on.offsetWidth) { el.style.setProperty('--sw', '0px'); return; }
    el.style.setProperty('--sx', `${on.offsetLeft}px`);
    el.style.setProperty('--sy', `${on.offsetTop}px`);
    el.style.setProperty('--sw', `${on.offsetWidth}px`);
    el.style.setProperty('--sh', `${on.offsetHeight}px`);
    if (el.dataset['slider'] !== 'ready') {
      // Wait one frame so the first position is applied without a transition.
      requestAnimationFrame(() => { el.dataset['slider'] = 'ready'; });
    }
  }

  // Stops watching for changes.
  ngOnDestroy(): void { this.mutations?.disconnect(); this.sizes?.disconnect(); }
}
