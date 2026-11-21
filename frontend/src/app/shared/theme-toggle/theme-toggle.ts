import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../core/theme.service';

let next = 0; // counter for unique mask ids

/** The dark/light toggle button; the sun-moon icon flips and the page animates a color change. */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <button type="button" class="tt" [class.dark]="theme.theme() === 'dark'" (click)="theme.toggle($event)"
            [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            [attr.title]="theme.theme() === 'dark' ? 'Light mode' : 'Dark mode'">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <mask [attr.id]="id"><rect width="24" height="24" fill="#fff" /><circle class="cut" cx="12" cy="12" r="7" fill="#000" /></mask>
        <circle class="core" cx="12" cy="12" r="5" fill="currentColor" [attr.mask]="'url(#' + id + ')'" />
        <g class="rays" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </g>
      </svg>
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    .tt { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border-radius: 50%; border: 1px solid var(--line); background: var(--surface); color: var(--fg); cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: background 0.25s var(--ease), border-color 0.25s var(--ease), transform 0.25s var(--ease); }
    .tt:active { transform: scale(0.9); }
    @media (hover: hover) { .tt:hover { background: var(--surface-2); border-color: var(--fg); } .tt:hover svg { transform: rotate(18deg); } }
    svg { overflow: visible; transition: transform 0.5s var(--ease); }
    .core { transform-origin: 12px 12px; transition: transform 0.6s var(--ease); }
    .cut { transform: translate(22px, -22px); transition: transform 0.6s var(--ease); }
    .rays { transform-origin: 12px 12px; opacity: 1; transition: transform 0.6s var(--ease), opacity 0.35s ease; }
    /* dark mode shows the moon: a bigger disc with a bite taken out of it, and the rays folded away */
    .dark .core { transform: scale(1.55); }
    .dark .cut { transform: translate(7px, -6px); }
    .dark .rays { opacity: 0; transform: rotate(-90deg) scale(0.4); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggle {
  readonly theme = inject(ThemeService);
  readonly id = `tt-mask-${next++}`;
}
