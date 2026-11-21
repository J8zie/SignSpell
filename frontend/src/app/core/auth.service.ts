import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from './api/api';
import { tokenStore } from './token';
import { Account, RegisterInput, Role, SetupInput } from './models';

/** Where each role lands after signing in. Admin and Super Admin share the same admin screens. */
export const HOME_BY_ROLE: Record<Role, string> = { learner: '/app', teacher: '/teacher', admin: '/admin', super_admin: '/admin' };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly account = signal<Account | null>(null);
  readonly role = computed(() => this.account()?.role ?? null);
  readonly homePath = computed(() => HOME_BY_ROLE[this.role() ?? 'learner']);

  /** Called once at startup: restores the session when a token is saved. */
  async restore(): Promise<void> {
    if (!tokenStore.get()) return;
    try { this.account.set(await this.api.me()); } catch { tokenStore.clear(); }
  }
  // Logs in, stores the token, and sets the current account.
  async login(username: string, password: string): Promise<Account> {
    const r = await this.api.login(username, password);
    tokenStore.set(r.token);
    this.account.set(r.account);
    return r.account;
  }
  // Registers a new account, stores the token, and sets the current account.
  async register(input: RegisterInput): Promise<Account> {
    const r = await this.api.register(input);
    tokenStore.set(r.token);
    this.account.set(r.account);
    return r.account;
  }
  /** True on the very first run, when no account exists yet. */
  needsSetup(): Promise<boolean> { return this.api.needsSetup(); }
  /** Creates the first account (a Super Admin) and signs in. */
  async setup(input: SetupInput): Promise<Account> {
    const r = await this.api.setupAdmin(input);
    tokenStore.set(r.token);
    this.account.set(r.account);
    return r.account;
  }
  // Logs out on the server, then clears the local session and goes home.
  async logout(): Promise<void> {
    try { await this.api.logout(); } catch { /* token may already be invalid */ }
    this.clear();
    await this.router.navigateByUrl('/');
  }
  /** Drops the session without calling the API (used on 401). */
  clear(): void {
    tokenStore.clear();
    this.account.set(null);
  }
  // Replaces the current account after a profile save.
  setAccount(a: Account): void { this.account.set(a); }
}
