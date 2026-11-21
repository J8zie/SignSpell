import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api, ApiError } from '../../../core/api/api';
import { AuthService } from '../../../core/auth.service';
import { Account, AccountStatus, AdminSummary, fullName, Role } from '../../../core/models';
import { assignableRoles, canManageAdmins, isAdminRole, ROLE_LABEL } from '../../../core/permissions';
import { ConfirmService } from '../../../core/confirm.service';
import { ToastService } from '../../../core/toast.service';
import { applyServerErrors, errorOf } from '../../../core/util/forms';
import { readFilters, writeFilters } from '../../../core/util/url-filters';
import { Modal } from '../../../shared/modal/modal';
import { Reveal } from '../../../shared/reveal';
import { Slider } from '../../../shared/slider';

/** Admin screen to view, create, edit, and delete user accounts. */
@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Reveal, Slider],
  templateUrl: './accounts.html',
  styleUrl: './accounts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Accounts implements OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly accounts = signal<Account[]>([]);
  readonly loading = signal(true);
  readonly q = signal('');
  readonly role = signal<'' | Role>('');
  readonly open = signal(false);
  readonly editing = signal<Account | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly name = fullName;
  readonly err = errorOf;
  readonly roleLabel = ROLE_LABEL;

  /** True only for the Super Admin. Decides whether the "Manage admins" area exists on this screen (UI only). */
  readonly isSuper = computed(() => canManageAdmins(this.auth.role()));

  /** The accounts this person may see; admins never see other admins here (UI filter only). */
  readonly visible = computed(() => this.accounts().filter((a) => this.isSuper() || !isAdminRole(a.role)));
  /** Admin-level accounts (Admin and Super admin), for the "Manage admins" area. */
  readonly admins = computed(() => this.visible().filter((a) => isAdminRole(a.role)));
  /** Learners and teachers. */
  readonly people = computed(() => this.visible().filter((a) => !isAdminRole(a.role)));
  /** True totals from the API (they do not change while searching). Falls back to the list until they arrive. */
  readonly summary = signal<AdminSummary | null>(null);
  readonly counts = computed(() => {
    const s = this.summary();
    return s
      ? { learner: s.learners, teacher: s.teachers, admin: s.admins }
      : { learner: this.visible().filter((a) => a.role === 'learner').length, teacher: this.visible().filter((a) => a.role === 'teacher').length, admin: this.admins().length };
  });

  /** The filter buttons above the list. "Admins" is only offered to the Super Admin. */
  readonly filters = computed<{ id: '' | Role; label: string }[]>(() => [
    { id: '', label: 'Everyone' }, { id: 'learner', label: 'Learners' }, { id: 'teacher', label: 'Teachers' },
    ...(this.isSuper() ? [{ id: 'admin' as Role, label: 'Admins' }] : []),
  ]);

  /** The roles offered in the form; only super admins may pick admin. */
  readonly roleChoices = computed<Role[]>(() => {
    const list = assignableRoles(this.auth.role());
    const current = this.editing()?.role;
    return current && !list.includes(current) ? [current] : list;
  });

  readonly form = inject(NonNullableFormBuilder).group({
    role: ['learner' as Role],
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_.]{3,20}$/)]],
    password: ['', [Validators.minLength(8)]],
    status: ['active' as AccountStatus],
  });
  private timer = 0;

  // Restores filters from the URL, loads accounts and totals.
  ngOnInit(): void {
    // Open exactly where the address says (?q=ada&role=teacher).
    const f = readFilters(this.route, ['q', 'role'] as const);
    this.q.set(f.q);
    this.role.set(['learner', 'teacher', 'admin'].includes(f.role) ? (f.role as Role) : '');
    void this.load();
    void this.loadSummary();
  }
  // Cancels the pending search timer.
  ngOnDestroy(): void { clearTimeout(this.timer); }

  // Fetches the account list for the current filters.
  async load(): Promise<void> {
    this.loading.set(true);
    try { this.accounts.set(await this.api.listAccounts({ q: this.q().trim() || undefined, role: this.role() || undefined })); }
    catch (e) { this.toast.error((e as Error).message); }
    finally { this.loading.set(false); }
  }
  private async loadSummary(): Promise<void> {
    try { this.summary.set(await this.api.adminSummary()); } catch { /* the totals are a bonus: the list still works */ }
  }
  // Debounces the search box and reloads the list.
  search(v: string): void { this.q.set(v); clearTimeout(this.timer); this.timer = window.setTimeout(() => { writeFilters(this.router, this.route, { q: v.trim() }); void this.load(); }, 250); }
  // Changes the role filter and reloads the list.
  setRole(v: '' | Role): void { this.role.set(v); writeFilters(this.router, this.route, { role: v }); void this.load(); }

  /** Opens the form to edit `a`, or to create a new account (with `preset` as the starting role). */
  openForm(a: Account | null, preset: Role = 'learner'): void {
    this.editing.set(a);
    this.error.set('');
    this.form.reset({ role: a?.role ?? preset, firstName: a?.info.firstName ?? '', lastName: a?.info.lastName ?? '', email: a?.info.email ?? '', username: a?.username ?? '', password: '', status: a?.status ?? 'active' });
    this.form.controls.password.setValidators(a ? [Validators.minLength(8)] : [Validators.required, Validators.minLength(8)]);
    this.form.controls.password.updateValueAndValidity();
    // The role of the Super admin's own account cannot be changed here.
    if (a && !assignableRoles(this.auth.role()).includes(a.role)) this.form.controls.role.disable(); else this.form.controls.role.enable();
    this.open.set(true);
  }

  // Saves the form: creates a new account or updates the edited one.
  async save(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    // getRawValue also returns the role while it is locked.
    const v = this.form.getRawValue();
    const input = { ...v, password: v.password || undefined };
    // A new account always starts active; the status picker only matters when editing.
    if (!this.editing()) input.status = 'active';
    try {
      const a = this.editing();
      // BACKEND INTEGRATION POINT: these two calls reach the backend, which must also check that only a
      // Super Admin may create or change an Admin account.
      if (a) await this.api.updateAccount(a.userId, input); else await this.api.createAccount(input);
      this.toast.ok(a ? 'Account updated.' : 'Account created.');
      this.open.set(false);
      await this.load();
      void this.loadSummary();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) applyServerErrors(this.form, e.fields);
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  // Asks for confirmation, then deletes the account.
  async remove(a: Account): Promise<void> {
    // Ask the server what would really go, so the dialog says "14 attempts", not a vague warning.
    let detail = 'and their attempts and progress';
    try {
      const i = await this.api.accountImpact(a.userId);
      const parts = [i.attempts ? `${i.attempts} ${i.attempts === 1 ? 'attempt' : 'attempts'}` : '', i.signsDonated ? `${i.signsDonated} donated ${i.signsDonated === 1 ? 'sign stays' : 'signs stay'}, with no teacher` : ''].filter(Boolean);
      detail = parts.length ? `and ${parts.join(', ')}` : '(nothing else is attached to this account)';
    } catch { /* the impact is only extra detail; the person can still decide */ }
    const ok = await this.confirm.ask({ title: 'Delete this account?', message: `${fullName(a)} (${a.username}) will be removed ${detail}. This cannot be undone.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await this.api.deleteAccount(a.userId); this.toast.ok('Account deleted.'); await this.load(); void this.loadSummary(); }
    catch (e) { this.toast.error((e as Error).message); }
  }
}
