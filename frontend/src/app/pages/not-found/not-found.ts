import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/** Shown when the URL does not match any page. */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="nf">
      <p class="code g-text">404</p>
      <h1>This page does not exist.</h1>
      <p class="muted">The link may be old, or the page moved.</p>
      <a class="btn" [routerLink]="auth.account() ? auth.homePath() : '/'">Go home</a>
    </section>`,
  styles: `.nf { min-height: 100svh; display: grid; place-content: center; justify-items: center; gap: 0.8rem; text-align: center; padding: 2rem; } .code { font-size: clamp(5rem, 22vw, 10rem); font-weight: 700; letter-spacing: -0.05em; line-height: 1; padding-right: 0.1em; } h1 { font-size: 1.6rem; font-weight: 600; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/** The 404 page with a link back home. */
export class NotFound { readonly auth = inject(AuthService); }
