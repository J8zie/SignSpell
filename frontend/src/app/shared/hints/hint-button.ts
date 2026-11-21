import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Quiet "Need a hint?" pill button; it only reports presses, the parent shows the hint. */
@Component({
  selector: 'app-hint-button',
  standalone: true,
  template: `
    <button type="button" class="hint-btn" [class.open]="open()" [attr.aria-expanded]="open()" [attr.aria-controls]="controls()" (click)="toggle.emit()">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
      </svg>
      <span>{{ open() ? 'Hide hint' : label() }}</span>
    </button>`,
  styles: `
    :host { display: inline-block; }
    .hint-btn { display: inline-flex; align-items: center; gap: 0.5rem; min-height: 40px; padding: 0.4rem 1rem 0.4rem 0.8rem; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); font: inherit; font-size: 0.88rem; font-weight: 500; cursor: pointer; transition: border-color 0.2s, background 0.2s, transform 0.2s; }
    .hint-btn:hover { border-color: var(--fg); }
    .hint-btn:active { transform: scale(0.97); }
    .hint-btn.open { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HintButton {
  /** True while the hint is showing (the button then offers to hide it). */
  readonly open = input(false);
  readonly label = input('Need a hint?');
  /** The id of the panel this button shows and hides, for screen readers. */
  readonly controls = input<string | null>(null);
  /** Reported when the learner presses the button. */
  readonly toggle = output<void>();
}
