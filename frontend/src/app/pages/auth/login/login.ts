import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthBrand } from '../../../shared/auth-brand/auth-brand';
import { AuthService, HOME_BY_ROLE } from '../../../core/auth.service';
import { errorOf } from '../../../core/util/forms';
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
  readonly form = inject(NonNullableFormBuilder).group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });
  readonly busy = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly err = errorOf;

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
