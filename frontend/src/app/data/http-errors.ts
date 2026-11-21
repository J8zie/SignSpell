import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '../core/api/api';

/** Turns a failed HTTP call into the same friendly ApiError every other screen already understands. */
export async function failWith<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (e) {
    if (e instanceof HttpErrorResponse) {
      const body = (e.error ?? {}) as { message?: string; errors?: Record<string, string[]> };
      throw new ApiError(e.status === 0 ? 'Cannot reach the server. Check your internet connection.' : body.message || 'Something went wrong.', e.status, body.errors ?? {});
    }
    throw e;
  }
}
