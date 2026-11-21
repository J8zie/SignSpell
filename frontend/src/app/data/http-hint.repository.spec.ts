import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { HttpHintRepository } from './http-hint.repository';

const base = environment.apiUrl.replace(/\/$/, '');

describe('HttpHintRepository', () => {
  let repo: HttpHintRepository;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpHintRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('reads a hint, and treats 404 as "no hint" instead of an error', async () => {
    const a = repo.get('s1');
    http.expectOne(`${base}/signs/s1/hint`).flush({ text: 'Keep your thumb across your palm.' });
    expect(await a).toBe('Keep your thumb across your palm.');
    const b = repo.get('s2');
    http.expectOne(`${base}/signs/s2/hint`).flush({ message: 'We could not find that.' }, { status: 404, statusText: 'Not Found' });
    expect(await b).toBeNull();
  });

  it('gets every hint in one call', async () => {
    const a = repo.getAll();
    http.expectOne(`${base}/signs/hints`).flush({ a: 'one', b: 'two' });
    expect(await a).toEqual({ a: 'one', b: 'two' });
  });

  it('saves a trimmed hint with PUT', async () => {
    const a = repo.save('s1', '  Wave.  ');
    const r = http.expectOne(`${base}/signs/s1/hint`);
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({ text: 'Wave.' });
    r.flush({ text: 'Wave.' });
    await a;
  });

  it('shows the server\'s message when saving fails', async () => {
    const a = repo.save('s1', 'x');
    http.expectOne(`${base}/signs/s1/hint`).flush({ message: 'You do not have access to this.' }, { status: 403, statusText: 'Forbidden' });
    await expect(a).rejects.toMatchObject({ message: 'You do not have access to this.', status: 403 });
  });

  it('removes a hint, and a missing hint is fine', async () => {
    const a = repo.remove('s1');
    http.expectOne(`${base}/signs/s1/hint`).flush(null, { status: 204, statusText: 'No Content' });
    await a;
    const b = repo.remove('s2');
    http.expectOne(`${base}/signs/s2/hint`).flush({}, { status: 404, statusText: 'Not Found' });
    await b;
  });
});
