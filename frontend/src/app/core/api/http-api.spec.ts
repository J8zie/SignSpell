import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ApiError } from './api';
import { HttpApi } from './http-api';

const base = environment.apiUrl.replace(/\/$/, '');

describe('HttpApi (the real Laravel API)', () => {
  let api: HttpApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(HttpApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('confirms deletes with ?confirm=1, because the server requires it', async () => {
    const a = api.deleteSign('s1');
    const r1 = http.expectOne((r) => r.url === `${base}/signs/s1`);
    expect(r1.request.method).toBe('DELETE');
    expect(r1.request.params.get('confirm')).toBe('1');
    r1.flush(null, { status: 204, statusText: 'No Content' });
    await a;

    const b = api.deleteAccount('u1');
    const r2 = http.expectOne((r) => r.url === `${base}/admin/accounts/u1`);
    expect(r2.request.method).toBe('DELETE');
    expect(r2.request.params.get('confirm')).toBe('1');
    r2.flush(null, { status: 204, statusText: 'No Content' });
    await b;
  });

  it('asks what a delete would remove before it happens', async () => {
    const a = api.signImpact('s1');
    http.expectOne(`${base}/signs/s1/impact`).flush({ attempts: 14, learners: 3, media: 2 });
    expect(await a).toEqual({ attempts: 14, learners: 3, media: 2 });
    const b = api.accountImpact('u1');
    http.expectOne(`${base}/admin/accounts/u1/impact`).flush({ attempts: 5, signsDonated: 1 });
    expect(await b).toEqual({ attempts: 5, signsDonated: 1 });
  });

  it('sends the person\'s time zone so days follow their own day', async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const a = api.mySummary();
    const r1 = http.expectOne((r) => r.url === `${base}/me/summary`);
    expect(r1.request.params.get('tz')).toBe(tz);
    r1.flush({});
    await a;

    const b = api.learnerProgress({ from: '2026-03-01', to: '2026-03-02', signId: 'x' });
    const r2 = http.expectOne((r) => r.url === `${base}/teacher/learners-progress`);
    expect(r2.request.params.get('tz')).toBe(tz);
    expect(r2.request.params.get('from')).toBe('2026-03-01');
    expect(r2.request.params.get('signId')).toBe('x');
    r2.flush([]);
    await b;

    const c = api.myAttempts({ limit: 6 });
    const r3 = http.expectOne((r) => r.url === `${base}/me/attempts`);
    expect(r3.request.params.get('tz')).toBe(tz);
    r3.flush([]);
    await c;
  });

  it('can clear a sign\'s owner on an edit, but leaves it out when creating', async () => {
    const edit = api.updateSign('s1', { signType: 'word', label: 'HELLO', ownerId: null });
    const r1 = http.expectOne(`${base}/signs/s1`);
    const f1 = r1.request.body as FormData;
    expect(f1.get('_method')).toBe('PUT');
    expect(f1.has('ownerId')).toBe(true);
    expect(f1.get('ownerId')).toBe('');
    r1.flush({});
    await edit;

    const create = api.createSign({ signType: 'word', label: 'HELLO', ownerId: null });
    const r2 = http.expectOne(`${base}/signs`);
    expect((r2.request.body as FormData).has('ownerId')).toBe(false);
    r2.flush({});
    await create;
  });

  it('changes the password with the two fields the server expects', async () => {
    const a = api.changePassword({ currentPassword: 'old-pass-1', newPassword: 'new-pass-22' });
    const r = http.expectOne(`${base}/profile/password`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ currentPassword: 'old-pass-1', newPassword: 'new-pass-22' });
    r.flush(null, { status: 204, statusText: 'No Content' });
    await a;
  });

  it('downloads the CSV with the same filters', async () => {
    const a = api.exportProgress({ signId: 'x' });
    const r = http.expectOne((q) => q.url === `${base}/teacher/learners-progress/export`);
    expect(r.request.responseType).toBe('blob');
    expect(r.request.params.get('signId')).toBe('x');
    r.flush(new Blob(['a,b']), { status: 200, statusText: 'OK' });
    expect(await (await a).text()).toBe('a,b');
  });

  it('turns a failed download into a readable message', async () => {
    const a = api.exportProgress({});
    http.expectOne((q) => q.url === `${base}/teacher/learners-progress/export`)
      .flush(new Blob([JSON.stringify({ message: 'You do not have access to this.' })]), { status: 403, statusText: 'Forbidden' });
    await expect(a).rejects.toMatchObject({ message: 'You do not have access to this.', status: 403 });
  });

  it('maps a 422 to an ApiError with the field messages', async () => {
    const a = api.login('x', 'y');
    http.expectOne(`${base}/auth/login`).flush({ message: 'Wrong username or password.', errors: { username: ['Wrong username or password.'] } }, { status: 422, statusText: 'Unprocessable' });
    const e = (await a.catch((x: unknown) => x)) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(422);
    expect(e.fields['username']).toEqual(['Wrong username or password.']);
  });

  it('says plainly when the server cannot be reached', async () => {
    const a = api.me();
    http.expectOne(`${base}/auth/me`).error(new ProgressEvent('error'));
    await expect(a).rejects.toMatchObject({ message: 'Cannot reach the server. Check your internet connection.', status: 0 });
  });
});
