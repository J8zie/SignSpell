import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Api, ApiError } from '../../core/api/api';
import { AuthService } from '../../core/auth.service';
import { fullName } from '../../core/models';
import { ROLE_LABEL } from '../../core/permissions';
import { ToastService } from '../../core/toast.service';
import { applyServerErrors, errorOf } from '../../core/util/forms';
import { AvatarPicker } from '../../shared/avatar-picker/avatar-picker';
import { HasUnsavedChanges } from '../../core/unsaved.guard';
import { Reveal } from '../../shared/reveal';

/** Everyone's own profile: photo, name and email. The role and username are shown but cannot be changed here. */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarPicker, Reveal, DatePipe],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile implements HasUnsavedChanges {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly form = inject(NonNullableFormBuilder).group({
    firstName: [this.auth.account()?.info.firstName ?? '', [Validators.required, Validators.maxLength(60)]],
    lastName: [this.auth.account()?.info.lastName ?? '', [Validators.required, Validators.maxLength(60)]],
    email: [this.auth.account()?.info.email ?? '', [Validators.required, Validators.email]],
  });
  readonly photo = signal<File | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly err = errorOf;

  /** The form as a signal, so "unsaved changes" and the Save button react while typing. */
  private readonly status = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly dirty = computed(() => {
    const v = this.status(); const i = this.auth.account()?.info;
    return !!this.photo() || v.firstName !== i?.firstName || v.lastName !== i?.lastName || v.email !== i?.email;
  });
  readonly roleLabel = computed(() => ROLE_LABEL[this.auth.role() ?? 'learner']);
  readonly name = computed(() => fullName(this.auth.account()));
  readonly initials = computed(() => {
    const i = this.auth.account()?.info;
    return i ? `${i.firstName[0] ?? ''}${i.lastName[0] ?? ''}`.toUpperCase() : '';
  });

  // ---------- change password ----------
  readonly passwordForm = inject(NonNullableFormBuilder).group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  }, { validators: (g) => (g.get('newPassword')?.value === g.get('confirm')?.value ? null : { mismatch: true }) });
  readonly pwBusy = signal(false);
  readonly pwError = signal('');
  readonly pwOpen = signal(false);

  // Saves the new password after validating it.
  async changePassword(): Promise<void> {
    this.pwError.set('');
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    this.pwBusy.set(true);
    try {
      const { currentPassword, newPassword } = this.passwordForm.getRawValue();
      await this.api.changePassword({ currentPassword, newPassword });
      this.passwordForm.reset();
      this.pwOpen.set(false);
      this.toast.ok('Password changed. Your other devices were signed out.');
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) applyServerErrors(this.passwordForm, e.fields);
      this.pwError.set((e as Error).message);
    } finally {
      this.pwBusy.set(false);
    }
  }

  /** Used by the leave-without-saving guard and the browser's own "are you sure" on refresh or close. */
  hasUnsavedChanges(): boolean { return this.dirty() || (this.pwOpen() && this.passwordForm.dirty); }
  // Warns the browser before leaving with unsaved changes.
  @HostListener('window:beforeunload', ['$event'])
  warn(e: BeforeUnloadEvent): void { if (this.hasUnsavedChanges()) e.preventDefault(); }

  // Saves the profile form and photo to the server.
  async save(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    try {
      this.auth.setAccount(await this.api.updateProfile({ ...this.form.getRawValue(), photo: this.photo() }));
      this.photo.set(null);
      this.form.markAsPristine();
      this.toast.ok('Profile saved.');
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) applyServerErrors(this.form, e.fields);
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  /** Puts the typed values back to what is saved. */
  reset(): void {
    const i = this.auth.account()?.info;
    this.form.reset({ firstName: i?.firstName ?? '', lastName: i?.lastName ?? '', email: i?.email ?? '' });
    this.photo.set(null);
  }
}
