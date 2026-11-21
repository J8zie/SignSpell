import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { fullName, Role } from '../../core/models';
import { ROLE_LABEL } from '../../core/permissions';
import { Slider } from '../../shared/slider';
import { ThemeToggle } from '../../shared/theme-toggle/theme-toggle';
import { Wordmark } from '../../shared/wordmark/wordmark';

/** One link in the top bar (and in the bottom tab bar on phones). */
interface NavItem { path: string; label: string; icon: string; exact?: boolean; }

/** Icon outlines (24x24 SVG paths) used by the links and the menu. */
const ICON: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  users: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  studio: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  hand: 'M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V3.5a1.5 1.5 0 0 1 3 0V11M14 11V5a1.5 1.5 0 0 1 3 0v8M8 13l-1.7-1.7a1.5 1.5 0 0 0-2.1 2.1L8 18a6 6 0 0 0 4.2 2H14a5 5 0 0 0 5-5v-2',
};

/**
 * Which links each role sees. This only shapes the interface: the backend must independently refuse
 * any request a role is not allowed to make. Admin and Super Admin share the People and Signs links;
 * the Audit link and the extra Super Admin controls inside the People screen are Super Admin only.
 */
const ADMIN_LINKS: NavItem[] = [{ path: '/admin', label: 'People', icon: 'users', exact: true }, { path: '/admin/signs', label: 'Signs', icon: 'hand' }]; // admin and super admin share these links
const SUPER_LINKS: NavItem[] = [...ADMIN_LINKS, { path: '/admin/audit', label: 'Audit', icon: 'chart' }];
const NAV: Record<Role, NavItem[]> = {
  learner: [{ path: '/app', label: 'Home', icon: 'home', exact: true }, { path: '/app/guide', label: 'Guide', icon: 'book' }, { path: '/app/progress', label: 'Progress', icon: 'chart' }],
  teacher: [{ path: '/teacher', label: 'Learners', icon: 'users', exact: true }, { path: '/teacher/donate', label: 'Studio', icon: 'studio' }],
  admin: ADMIN_LINKS,
  super_admin: SUPER_LINKS,
};

/** Top navigation bar and bottom tab bar shown around every signed-in page. */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Wordmark, Slider, ThemeToggle],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Whether the account menu is open. */
  readonly menu = signal(false);
  readonly icons = ICON;
  readonly items = computed(() => NAV[this.auth.role() ?? 'learner']);
  readonly name = computed(() => fullName(this.auth.account()));
  /** "Teacher", "Super admin", ... shown as a small chip so it is always clear which role is signed in. */
  readonly roleLabel = computed(() => ROLE_LABEL[this.auth.role() ?? 'learner']);
  readonly initials = computed(() => {
    const i = this.auth.account()?.info;
    return i ? `${i.firstName[0] ?? ''}${i.lastName[0] ?? ''}`.toUpperCase() : '';
  });

  /** A click anywhere outside the account menu closes it. */
  @HostListener('document:click', ['$event'])
  outside(e: Event): void {
    if (this.menu() && !this.host.nativeElement.querySelector('.account')?.contains(e.target as Node)) this.menu.set(false);
  }
  @HostListener('document:keydown.escape')
  // Closes the account menu on Escape.
  esc(): void { this.menu.set(false); }
  // Asks first, then signs out and closes the menu.
  async logout(): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Log out?', message: 'You will need to sign in again to continue.', confirmLabel: 'Log out' });
    if (!ok) return;
    this.menu.set(false);
    await this.auth.logout();
  }
}
