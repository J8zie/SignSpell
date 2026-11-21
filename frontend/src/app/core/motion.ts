import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Registers GSAP plugins and re-exports them for the whole app. */
gsap.registerPlugin(ScrollTrigger, Flip);
export { gsap, Flip, ScrollTrigger };

/** True when the person asked their device for less motion. Animations then jump straight to the end state. */
export const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The shared look of the app's motion: quick, soft landing. */
export const EASE = 'power3.out';

/** Fades and lifts elements in one after another; does nothing when reduced motion is on. */
export function riseIn(targets: gsap.TweenTarget, opts: gsap.TweenVars = {}): gsap.core.Tween | null {
  if (reducedMotion()) return null;
  return gsap.fromTo(targets, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55, ease: EASE, stagger: 0.06, clearProps: 'opacity,transform', ...opts });
}

/** Groups a component's animations so they all stop when the component is destroyed. */
export class Motion {
  private readonly ctx: gsap.Context;
  // Starts a cleanup scope covering the given element or selector.
  constructor(scope: Element | string) {
    this.ctx = gsap.context(() => undefined, scope);
  }
  /** Runs `fn` inside the context so the tweens it creates are cleaned up with the component. */
  run(fn: () => void): void { this.ctx.add(fn); }
  destroy(): void { this.ctx.revert(); }
}

/** Opens a <dialog> with a short pop-in animation. */
export function openDialog(d: HTMLDialogElement): void {
  if (!d.open) d.showModal();
  gsap.killTweensOf(d);
  if (reducedMotion()) return;
  gsap.fromTo(d, { opacity: 0, y: 28, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: EASE, clearProps: 'opacity,transform' });
}

/** Plays a quick fade-out and then closes the dialog. */
export function closeDialog(d: HTMLDialogElement): void {
  if (!d.open) return;
  gsap.killTweensOf(d);
  if (reducedMotion()) { d.close(); return; }
  gsap.to(d, { opacity: 0, y: 16, scale: 0.97, duration: 0.18, ease: 'power2.in', onComplete: () => { d.close(); gsap.set(d, { clearProps: 'opacity,transform' }); } });
}
