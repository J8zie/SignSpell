import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api, ApiError } from './api';
import { environment } from '../../../environments/environment';
import {
  Account, AccountInput, Attempt, AttemptInput, AttemptQuery, AttemptResult, AuditLog, AuditQuery, AuthResponse, LearnerProgressRow,
  Mastery, MediaAnalysis, ProfileInput, ProgressQuery, RegisterInput, Sign, SignInput, SignQuery, SignSampleInfo, SignSampleInput,
  AccountImpact, AdminSummary, LearnerSummary, Page, PasswordInput, SignImpact, TeacherSummary,
} from '../models';

/** Returns the device's time zone so the API's "today" matches the user's day. */
const zone = (): string | undefined => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; } };

// Drops empty values so they are not sent as query parameters.
const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

/** Talks to the Laravel REST API. Routes and payloads are listed in docs/API.md. */
@Injectable({ providedIn: 'root' })
export class HttpApi extends Api {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/$/, '');

  // Runs a request and turns HTTP errors into friendly ApiError messages.
  private async call<T>(req: Promise<T>): Promise<T> {
    try {
      return await req;
    } catch (e) {
      if (e instanceof HttpErrorResponse) {
        const body = (e.error ?? {}) as { message?: string; errors?: Record<string, string[]> };
        const msg = e.status === 0 ? 'Cannot reach the server. Check your internet connection.' : body.message || 'Something went wrong.';
        throw new ApiError(msg, e.status, body.errors ?? {});
      }
      throw e;
    }
  }
  // Sends a GET request with query parameters.
  private get<T>(path: string, params: Record<string, unknown> = {}) {
    return this.call(firstValueFrom(this.http.get<T>(`${this.base}${path}`, { params: new HttpParams({ fromObject: clean(params) as Record<string, string> }) })));
  }
  // Sends a POST/PUT/DELETE request with an optional body and query parameters.
  private send<T>(method: 'post' | 'put' | 'delete', path: string, body?: unknown, params: Record<string, unknown> = {}) {
    return this.call(firstValueFrom(this.http.request<T>(method, `${this.base}${path}`, { body, params: new HttpParams({ fromObject: clean(params) as Record<string, string> }) })));
  }
  /** A file download (the CSV). Errors still arrive as JSON, so they are read back from the blob. */
  private async download(path: string, params: Record<string, unknown> = {}): Promise<Blob> {
    try {
      return await firstValueFrom(this.http.get(`${this.base}${path}`, { params: new HttpParams({ fromObject: clean(params) as Record<string, string> }), responseType: 'blob' }));
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.error instanceof Blob) {
        let body: { message?: string } = {};
        try { body = JSON.parse(await e.error.text()); } catch { /* not JSON */ }
        throw new ApiError(e.status === 0 ? 'Cannot reach the server. Check your internet connection.' : body.message || 'Something went wrong.', e.status);
      }
      throw new ApiError('Cannot reach the server. Check your internet connection.', 0);
    }
  }
  // Builds multipart form data from plain fields and files.
  private form(fields: Record<string, unknown>, files: Record<string, File | null | undefined> = {}, keepEmpty: string[] = []): FormData {
    const f = new FormData();
    Object.entries(clean(fields)).forEach(([k, v]) => f.append(k, String(v)));
    // Some fields mean something when empty (an empty owner = "no teacher"), so they are still sent.
    keepEmpty.forEach((k) => { if (!(k in clean(fields))) f.append(k, ''); });
    Object.entries(files).forEach(([k, v]) => v && f.append(k, v));
    return f;
  }

  // Logs in and returns a token plus the account.
  login(username: string, password: string) { return this.send<AuthResponse>('post', '/auth/login', { username, password }); }
  // Creates a learner or teacher account.
  register(input: RegisterInput) { return this.send<AuthResponse>('post', '/auth/register', input); }
  // Ends the current session.
  logout() { return this.send<void>('post', '/auth/logout'); }
  // Returns the signed-in account.
  me() { return this.get<Account>('/auth/me'); }
  // Saves profile changes, including an optional new photo.
  updateProfile(i: ProfileInput) {
    // multipart + method override because PHP only parses multipart bodies on POST
    return this.send<Account>('post', '/profile', this.form({ _method: 'PUT', firstName: i.firstName, lastName: i.lastName, email: i.email }, { photo: i.photo }));
  }

  // Changes the signed-in user's password.
  changePassword(i: PasswordInput) { return this.send<void>('post', '/profile/password', i); }

  // Lists signs with optional filters.
  listSigns(q: SignQuery = {}) { return this.get<Sign[]>('/signs', { type: q.type, q: q.q, mine: q.mine ? 1 : undefined }); }
  // Returns one sign's details.
  getSign(id: string) { return this.get<Sign>(`/signs/${id}`); }
  // Adds a new sign with its image.
  createSign(i: SignInput) { return this.send<Sign>('post', '/signs', this.form({ label: i.label, signType: i.signType, ownerId: i.ownerId }, { image: i.image })); }
  // Updates a sign, keeping its id so media stays attached.
  updateSign(id: string, i: SignInput) { return this.send<Sign>('post', `/signs/${id}`, this.form({ _method: 'PUT', label: i.label, signType: i.signType, ownerId: i.ownerId }, { image: i.image }, ['ownerId'])); }
  // Returns what deleting this sign would remove.
  signImpact(id: string) { return this.get<SignImpact>(`/signs/${id}/impact`); }
  // Deletes a sign after the user confirmed.
  deleteSign(id: string) { return this.send<void>('delete', `/signs/${id}`, undefined, { confirm: 1 }); }

  // Saves one practice attempt and returns the updated mastery.
  recordAttempt(i: AttemptInput) { return this.send<AttemptResult>('post', '/attempts', i); }
  // Lists the learner's past attempts.
  myAttempts(q: AttemptQuery = {}) { return this.get<Attempt[]>('/me/attempts', { ...q, tz: zone() }); }
  // Lists the learner's mastery level per sign.
  myMastery() { return this.get<Mastery[]>('/me/mastery'); }
  // Returns the learner's dashboard totals and suggestions.
  mySummary() { return this.get<LearnerSummary>('/me/summary', { tz: zone() }); }

  // Lists learner-by-sign progress rows for the teacher.
  learnerProgress(q: ProgressQuery = {}) { return this.get<LearnerProgressRow[]>('/teacher/learners-progress', { ...q, tz: zone() }); }
  // Returns stats about the teacher's donated signs.
  teacherSummary() { return this.get<TeacherSummary>('/teacher/summary'); }
  // Downloads the progress table as a CSV file.
  exportProgress(q: ProgressQuery = {}) { return this.download('/teacher/learners-progress/export', { ...q, tz: zone() }); }

  // Lists accounts for the admin.
  listAccounts(q: { q?: string; role?: string } = {}) { return this.get<Account[]>('/admin/accounts', { ...q }); }
  // Creates a new account.
  createAccount(i: AccountInput) { return this.send<Account>('post', '/admin/accounts', i); }
  // Updates an existing account.
  updateAccount(id: string, i: AccountInput) { return this.send<Account>('put', `/admin/accounts/${id}`, i); }
  // Returns what deleting this account would affect.
  accountImpact(id: string) { return this.get<AccountImpact>(`/admin/accounts/${id}/impact`); }
  // Deletes an account after the admin confirmed.
  deleteAccount(id: string) { return this.send<void>('delete', `/admin/accounts/${id}`, undefined, { confirm: 1 }); }
  // Returns dashboard totals for the admin.
  adminSummary() { return this.get<AdminSummary>('/admin/summary', { tz: zone() }); }

  // Lists one page of audit log entries with optional filters (Super Admin only).
  async listAuditLogs(q: AuditQuery = {}): Promise<Page<AuditLog>> {
    const res = await this.get<{ data: AuditLog[]; meta: { current_page: number; last_page: number; total: number } }>('/admin/audit-logs', { ...q });
    return { items: res.data, page: res.meta.current_page, pages: res.meta.last_page, total: res.meta.total };
  }
  // Lists the days that have audit entries, newest first (Super Admin only).
  listAuditDates() { return this.get<string[]>('/admin/audit-logs/dates'); }
  // Returns one audit log entry.
  getAuditLog(id: string) { return this.get<AuditLog>(`/admin/audit-logs/${id}`); }

  // Asks Gemini what sign sequence the sign's media shows (teacher/super admin only).
  analyzeSignMedia(signId: string) { return this.send<MediaAnalysis>('post', `/signs/${signId}/media/analyze`); }
  // Lists a sign's landmark samples (metadata only).
  listSignSamples(signId: string) { return this.get<SignSampleInfo[]>(`/signs/${signId}/samples`); }
  // Saves a landmark sequence extracted on the device.
  addSignSample(signId: string, i: SignSampleInput) { return this.send<{ sampleId: string; frameCount: number }>('post', `/signs/${signId}/samples`, i); }
}
