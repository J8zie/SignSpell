import { Injectable, signal } from '@angular/core';

export type ThemeName = 'dark' | 'light';
const KEY = 'signspell-theme';
/** Kept local (not imported from the animation helpers) so choosing a theme never has to load the animation library. */
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A click position (or the middle of an element) the water drop starts from. */
export interface DropOrigin { x: number; y: number; }

/** Owns the dark/light choice and plays a water-drop animation when switching. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<ThemeName>(this.initial());
  private busy = false;

  constructor() { this.apply(this.theme()); }

  /** Switches theme. Pass the button (or the click) so the drop starts from the right place. */
  toggle(from?: HTMLElement | MouseEvent | null): void {
    if (this.busy) return;
    const next: ThemeName = this.theme() === 'dark' ? 'light' : 'dark';
    const origin = this.originOf(from);
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } };

    if (reducedMotion() || !doc.startViewTransition) { this.fade(() => this.set(next)); return; }

    this.busy = true;
    this.ripple(origin);
    const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    const vt = doc.startViewTransition(() => this.set(next));
    vt.ready.then(() => {
      // The new colours grow out of the drop as a circle. The slight overshoot in the easing feels like liquid spreading.
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 900, easing: 'cubic-bezier(0.22, 0.8, 0.24, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => undefined);
    vt.finished.finally(() => { this.busy = false; });
  }

  // Saves the theme and writes it onto the page.
  private set(t: ThemeName): void {
    this.theme.set(t);
    this.apply(t);
    try { localStorage.setItem(KEY, t); } catch { /* private mode: ignore */ }
  }

  /** Writes the theme to the page. The browser tab colour is read from the stylesheet, so no colour is repeated in code. */
  private apply(t: ThemeName): void {
    const root = document.documentElement;
    root.setAttribute('data-theme', t);
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  }

  /** Fallback: let the colours cross-fade through CSS. */
  private fade(change: () => void): void {
    const root = document.documentElement;
    root.classList.add('theming');
    change();
    setTimeout(() => root.classList.remove('theming'), 500);
  }

  /** Two thin rings that spread out from the drop point and fade, like ripples on water. */
  private ripple(o: DropOrigin): void {
    for (let i = 0; i < 2; i++) {
      const ring = document.createElement('span');
      ring.className = 'water-ring';
      ring.style.left = `${o.x}px`;
      ring.style.top = `${o.y}px`;
      document.body.appendChild(ring);
      const size = Math.hypot(innerWidth, innerHeight) * 2;
      const anim = ring.animate(
        [{ width: '0px', height: '0px', opacity: 0.9 }, { width: `${size}px`, height: `${size}px`, opacity: 0 }],
        { duration: 1100, delay: 120 + i * 140, easing: 'cubic-bezier(0.22, 0.8, 0.24, 1)', fill: 'both' },
      );
      anim.onfinish = () => ring.remove();
    }
  }

  // Works out where the drop animation should start from.
  private originOf(from?: HTMLElement | MouseEvent | null): DropOrigin {
    if (from instanceof MouseEvent && (from.clientX || from.clientY)) return { x: from.clientX, y: from.clientY };
    const el = from instanceof HTMLElement ? from : null;
    if (el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    return { x: innerWidth - 40, y: 32 };
  }

  // Picks the starting theme: saved choice first, dark otherwise.
  private initial(): ThemeName {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* ignore */ }
    return 'dark';
  }
}
