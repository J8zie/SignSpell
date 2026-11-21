import { DatePipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Api } from '../../../core/api/api';
import { AuditLog, Role } from '../../../core/models';
import { ROLE_LABEL } from '../../../core/permissions';
import { ToastService } from '../../../core/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { Reveal } from '../../../shared/reveal';

/** Read-only audit trail viewer for the Super Admin; there is deliberately no edit or delete here. */
@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [DatePipe, JsonPipe, Modal, Reveal],
  templateUrl: './audit.html',
  styleUrl: './audit.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Audit implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  readonly logs = signal<AuditLog[]>([]);
  readonly loading = signal(true);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly q = signal('');
  readonly role = signal<'' | Role>('');
  readonly action = signal('');
  readonly resource = signal('');
  readonly day = signal('');
  readonly dates = signal<string[]>([]);
  readonly selected = signal<AuditLog | null>(null);
  readonly roleLabel = ROLE_LABEL;
  private timer = 0;

  // Real action names written by the API's Audit service.
  readonly actions = [
    'auth.login', 'auth.login_failed', 'auth.logout', 'auth.register',
    'profile.password_change', 'profile.update',
    'account.create', 'account.update', 'account.delete',
    'sign.create', 'sign.update', 'sign.delete',
    'sign.hint_update', 'sign.hint_delete', 'sign.media_update', 'sign.media_delete', 'sign.media_analyze', 'sign.sample_add',
  ];
  readonly roles: ('' | Role)[] = ['', 'learner', 'teacher', 'admin', 'super_admin'];

  // Colour tone for the action chip: destructive, good, or warning.
  tone(action: string): 'del' | 'ok' | 'warn' | '' {
    if (action.includes('delete') || action.includes('login_failed')) return 'del';
    if (action.includes('approve') || action.includes('restore')) return 'ok';
    if (action.includes('reject')) return 'warn';
    return '';
  }

  // Loads the days that have entries, then the latest audit entries.
  async ngOnInit(): Promise<void> {
    try { this.dates.set(await this.api.listAuditDates()); } catch { /* the date filter is a bonus: the list still works */ }
    await this.load();
  }

  // Fetches the current page of audit entries matching the filters.
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.listAuditLogs({
        q: this.q().trim() || undefined, role: this.role() || undefined, action: this.action() || undefined,
        resource: this.resource().trim() || undefined, from: this.day() || undefined, to: this.day() || undefined,
        page: this.page(),
      });
      this.logs.set(res.items);
      this.page.set(res.page);
      this.pages.set(res.pages);
      this.total.set(res.total);
    } catch (e) { this.toast.error((e as Error).message); }
    finally { this.loading.set(false); }
  }
  // Debounces the search box and reloads from the first page.
  search(v: string): void { this.q.set(v); clearTimeout(this.timer); this.timer = window.setTimeout(() => this.apply(), 300); }
  // Reloads from the first page after a filter changes.
  apply(): void { this.page.set(1); void this.load(); }
  // Goes to another page of results.
  goToPage(p: number): void {
    if (p < 1 || p > this.pages() || p === this.page()) return;
    this.page.set(p);
    void this.load();
  }
  // Opens the detail view for one entry.
  show(l: AuditLog): void { this.selected.set(l); }
}
