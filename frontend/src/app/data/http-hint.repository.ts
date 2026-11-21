import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { failWith } from './http-errors';
import { HintRepository } from './hint.repository';

/** Teacher hints saved on the server (Laravel). Same four methods as the browser-only version, so no screen changes. */
@Injectable({ providedIn: 'root' })
export class HttpHintRepository extends HintRepository {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/$/, '');

  // Fetches one sign's hint; a 404 means "no hint" and returns null.
  async get(signId: string): Promise<string | null> {
    try {
      const r = await firstValueFrom(this.http.get<{ text: string }>(`${this.base}/signs/${signId}/hint`));
      return r.text ?? null;
    } catch (e) {
      // 404 simply means "no hint for this sign": that is normal, not an error.
      if (e instanceof HttpErrorResponse && e.status === 404) return null;
      return failWith(Promise.reject(e));
    }
  }

  /** One call for every hint, so lists can show a small "has a hint" badge without asking per sign. */
  getAll(): Promise<Record<string, string>> {
    return failWith(firstValueFrom(this.http.get<Record<string, string>>(`${this.base}/signs/hints`)));
  }

  /** Creates or replaces the hint. A blank text removes it (the server does that). */
  async save(signId: string, text: string): Promise<void> {
    await failWith(firstValueFrom(this.http.put<unknown>(`${this.base}/signs/${signId}/hint`, { text: text.trim() })));
  }

  // Deletes one sign's hint; a missing hint is not an error.
  async remove(signId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<void>(`${this.base}/signs/${signId}/hint`));
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) return;
      await failWith(Promise.reject(e));
    }
  }
}
