import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ThemeToggle } from '../shared/theme-toggle/theme-toggle';
import { CHAPTERS } from './content';
import { Wordmark } from '../shared/wordmark/wordmark';
import { Preloader } from './preloader/preloader';
import { HeroPanel } from './panels/hero-panel/hero-panel';
import { PuzzlePanel } from './panels/puzzle-panel/puzzle-panel';
import { AboutPanels } from './panels/about-panels/about-panels';
import { HowPanels } from './panels/how-panels/how-panels';
import { FooterPanel } from './panels/footer-panel/footer-panel';

const SEEN = 'signspell-intro-seen';

/** Landing page: a sideways-scroll track of panels driven by normal vertical scrolling. */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, Wordmark, ThemeToggle, Preloader, HeroPanel, PuzzlePanel, AboutPanels, HowPanels, FooterPanel],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** Landing page component. */
export class Landing implements OnInit, AfterViewInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly chapters = CHAPTERS;
  readonly showIntro = !this.seen();
  readonly ready = signal(!this.showIntro);
  readonly progress = signal(0);
  readonly active = signal<string>('home');
  readonly menu = signal(false);
  readonly stacked = signal(false);
  readonly idx = computed(() => String(Math.max(0, CHAPTERS.findIndex((c) => c.id === this.active())) + 1).padStart(2, '0'));
  readonly activeLabel = computed(() => CHAPTERS.find((c) => c.id === this.active())?.label ?? '');

  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly pin = viewChild.required<ElementRef<HTMLElement>>('pin');
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly html = document.documentElement;
  private maxX = 0;
  private edge = 0;
  private offsets: Record<string, number> = {};
  private raf = 0;
  private loop = 0;
  private target = 0;
  private cur = 0;
  private ro?: ResizeObserver;
  private panelGeo: { el: HTMLElement; mid: number }[] = [];
  // touch drag state
  private drag: { x: number; y: number; t: number; mode: '' | 'x' | 'y' } | null = null;
  private vel = 0;

  // Adds the loading class and disables horizontal overscroll.
  ngOnInit(): void {
    if (this.showIntro) this.html.classList.add('is-loading');
    this.html.style.overscrollBehaviorX = 'none';
  }

  // Measures the track and hooks up scroll, wheel, and resize listeners.
  ngAfterViewInit(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.stacked.set(true);
      return;
    }
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this.pin().nativeElement);
    this.ro.observe(this.track().nativeElement);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('wheel', this.onWheel, { passive: true });
    this.measure();
  }

  // Removes listeners, cancels animations, and restores page styles.
  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('wheel', this.onWheel);
    this.ro?.disconnect();
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.loop);
    this.html.classList.remove('is-loading');
    this.html.style.overscrollBehaviorX = '';
  }

  // Marks the intro as seen and enables the page.
  onReady(): void {
    this.ready.set(true);
    this.html.classList.remove('is-loading');
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* ignore */ }
  }

  /** Jump to a chapter (Home, About, How it works, Contact). */
  go(id: string): void {
    this.menu.set(false);
    if (this.stacked()) {
      this.track().nativeElement.querySelector(`[data-chapter="${id}"]`)?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const x = Math.max(0, Math.min(this.maxX, (this.offsets[id] ?? 0) - this.edge));
    const top = this.root().nativeElement.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + x, behavior: 'auto' }); // the eased track below does the gliding
  }

  // ---------- scroll engine ----------
  private readonly onScroll = () => {
    if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.update(); });
  };

  private measure(): void {
    const pin = this.pin().nativeElement, track = this.track().nativeElement;
    this.edge = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    this.maxX = Math.max(0, track.scrollWidth - pin.clientWidth);
    this.root().nativeElement.style.height = `${pin.clientHeight + this.maxX}px`;
    this.offsets = {};
    track.querySelectorAll<HTMLElement>('[data-chapter]').forEach((el) => (this.offsets[el.dataset['chapter']!] = el.offsetLeft));
    this.panelGeo = Array.from(track.querySelectorAll<HTMLElement>('.lp')).map((el) => ({ el, mid: el.offsetLeft + el.offsetWidth / 2 }));
    this.readTarget();
    this.cur = this.target; // after a resize, no gliding: just be there
    this.render();
  }

  private readTarget(): void {
    const top = this.root().nativeElement.getBoundingClientRect().top;
    this.target = Math.min(this.maxX, Math.max(0, -top));
  }

  /** The page scroll sets where the track WANTS to be; the track eases toward it, so wheel notches feel like glides. */
  private update(): void {
    this.readTarget();
    if (!this.loop) this.loop = requestAnimationFrame(this.tick);
  }

  // Starts the eased scroll loop toward the current target.
  private readonly tick = () => {
    this.loop = 0;
    const d = this.target - this.cur;
    this.cur = Math.abs(d) < 0.3 ? this.target : this.cur + d * 0.13;
    this.render();
    if (this.cur !== this.target) this.loop = requestAnimationFrame(this.tick);
  };

  // Updates the track position, progress bar, and active chapter.
  private render(): void {
    const sh = this.cur;
    this.track().nativeElement.style.transform = `translate3d(${-sh}px,0,0)`;
    this.progress.set(this.maxX ? sh / this.maxX : 0);
    const probe = sh + this.pin().nativeElement.clientWidth * 0.4;
    let cur = 'home';
    for (const c of CHAPTERS) if ((this.offsets[c.id] ?? Infinity) <= probe) cur = c.id;
    if (this.maxX && sh >= this.maxX - 2) cur = 'contact';
    this.active.set(cur);
    this.focusPanels(sh);
  }

  /**
   * Scroll-linked reveal. A panel is fully built when its middle is at the middle of the screen, and it
   * fades away as it moves off to either side. The CSS (--f, --s on .lp) turns these two numbers into
   * the build-up of each piece of content.
   */
  private focusPanels(sh: number): void {
    const vw = this.pin().nativeElement.clientWidth;
    const centre = vw / 2;
    const dead = vw * 0.1;   // panels this close to the middle count as fully in focus
    const reach = vw * 0.4;  // distance over which a panel fades from full to gone
    for (const { el, mid } of this.panelGeo) {
      const d = mid - sh - centre;
      let f = Math.min(1, Math.max(0, 1 - (Math.abs(d) - dead) / reach));
      if (sh <= 1 && el.dataset['chapter'] === 'home') f = 1;               // the very start always shows the hero
      if (this.maxX && sh >= this.maxX - 1 && el.dataset['chapter'] === 'contact') f = 1; // and the very end the footer
      el.style.setProperty('--f', f.toFixed(3));
      el.style.setProperty('--s', d === 0 ? '0' : d > 0 ? '1' : '-1');
    }
  }

  /** Trackpads and mice with sideways scrolling move the page too. */
  // Converts horizontal trackpad/mouse wheel movement into page scroll.
  private readonly onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) window.scrollBy(0, e.deltaX);
  };

  /** A sideways swipe on a touch screen scrolls the page (vertical swipes already do). */
  // Starts tracking a sideways touch drag.
  onPointerDown(e: PointerEvent): void {
    if (e.pointerType !== 'touch' || this.stacked()) return;
    this.vel = 0;
    this.drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, mode: '' };
  }
  // Scrolls the page while a sideways touch drag is in progress.
  onPointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.mode && Math.hypot(dx, dy) > 8) d.mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
    if (d.mode !== 'x') return;
    window.scrollBy(0, -dx);
    this.vel = dx / Math.max(1, e.timeStamp - d.t);
    d.x = e.clientX; d.y = e.clientY; d.t = e.timeStamp;
  }
  // Ends the drag and glides the page with the leftover swipe speed.
  onPointerEnd(): void {
    const d = this.drag;
    this.drag = null;
    if (d?.mode !== 'x') return;
    const glide = () => {
      this.vel *= 0.94;
      if (Math.abs(this.vel) < 0.02) return;
      window.scrollBy(0, -this.vel * 16);
      requestAnimationFrame(glide);
    };
    requestAnimationFrame(glide);
  }

  // Arrow keys scroll one panel left or right.
  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (this.stacked() || (e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); window.scrollBy({ top: innerWidth * 0.55, behavior: 'auto' }); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); window.scrollBy({ top: -innerWidth * 0.55, behavior: 'auto' }); }
  }

  // Checks whether the intro was already shown this session.
  private seen(): boolean {
    try { return sessionStorage.getItem(SEEN) === '1'; } catch { return false; }
  }
}
