import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthBrand } from '../../../shared/auth-brand/auth-brand';
import { AuthService, HOME_BY_ROLE } from '../../../core/auth.service';
import { errorOf } from '../../../core/util/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeToggle } from '../../../shared/theme-toggle/theme-toggle';
import { Wordmark } from '../../../shared/wordmark/wordmark';

/** Login form; on success it sends the user to their role's home page. */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthBrand, Wordmark, ThemeToggle],
  templateUrl: './login.html',
  styleUrl: '../auth.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly form = inject(NonNullableFormBuilder).group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });
  readonly busy = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly notice = signal('');
  readonly err = errorOf;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      if (p.get('registered') === '1') this.notice.set('Account created. Log in with your username and password.');
    });
  }

  // Logs in with the username and password, then navigates home.
  async submit(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    try {
      const { username, password } = this.form.getRawValue();
      const me = await this.auth.login(username, password);
      await this.router.navigateByUrl(HOME_BY_ROLE[me.role]);
    } catch (e) {
      this.error.set((e as Error).message || 'Could not log in.');
    } finally {
      this.busy.set(false);
    }
  }
}
