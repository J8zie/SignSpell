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
  readonly q = signal('');
  readonly role = signal<'' | Role>('');
  readonly action = signal('');
  readonly resource = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly selected = signal<AuditLog | null>(null);
  readonly roleLabel = ROLE_LABEL;
  private timer = 0;

  readonly actions = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'DONATE', 'APPROVE', 'REJECT', 'ASSIGN', 'RESTORE', 'PASSWORD_CHANGE', 'ACCOUNT_STATUS', 'ROLE_CHANGE'];
  readonly roles: ('' | Role)[] = ['', 'learner', 'teacher', 'admin', 'super_admin'];

  // Loads the latest audit entries.
  async ngOnInit(): Promise<void> { await this.load(); }

  // Fetches audit entries matching the current filters.
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.logs.set(await this.api.listAuditLogs({
        q: this.q().trim() || undefined, role: this.role() || undefined, action: this.action() || undefined,
        resource: this.resource().trim() || undefined, from: this.from() || undefined, to: this.to() || undefined, limit: 200,
      }));
    } catch (e) { this.toast.error((e as Error).message); }
    finally { this.loading.set(false); }
  }
  // Debounces the search box and reloads.
  search(v: string): void { this.q.set(v); clearTimeout(this.timer); this.timer = window.setTimeout(() => void this.load(), 300); }
  // Reloads after a filter changes.
  apply(): void { void this.load(); }
  // Opens the detail view for one entry.
  show(l: AuditLog): void { this.selected.set(l); }
}
