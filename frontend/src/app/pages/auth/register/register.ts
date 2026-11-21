import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthBrand } from '../../../shared/auth-brand/auth-brand';
import { ApiError } from '../../../core/api/api';
import { AuthService, HOME_BY_ROLE } from '../../../core/auth.service';
import { applyServerErrors, errorOf } from '../../../core/util/forms';
import { Slider } from '../../../shared/slider';
import { ThemeToggle } from '../../../shared/theme-toggle/theme-toggle';
import { Wordmark } from '../../../shared/wordmark/wordmark';

const same = (g: AbstractControl): ValidationErrors | null =>
  g.get('password')?.value === g.get('confirm')?.value ? null : { mismatch: true }; // group validator: passwords must match

/** Registration form for new learner or teacher accounts. */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthBrand, Wordmark, ThemeToggle, Slider],
  templateUrl: './register.html',
  styleUrl: '../auth.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly form = inject(NonNullableFormBuilder).group({
    role: ['learner' as 'learner' | 'teacher'],
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_.]{3,20}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  }, { validators: same });
  readonly busy = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly showConfirm = signal(false);
  readonly err = errorOf;

  // Creates the account, then navigates to the role's home page.
  async submit(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    try {
      const { confirm, ...input } = this.form.getRawValue();
      void confirm;
      const me = await this.auth.register(input);
      await this.router.navigateByUrl(HOME_BY_ROLE[me.role]);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) applyServerErrors(this.form, e.fields);
      this.error.set((e as Error).message || 'Could not create the account.');
    } finally {
      this.busy.set(false);
    }
  }
}
