import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { MediaItem } from '../shared/media/media-item';
import { HttpLessonMediaRepository } from './http-lesson-media.repository';

const base = environment.apiUrl.replace(/\/$/, '');
const ID1 = '01a1f5d7-4c88-7b8d-8d9f-2551c9cb89e1';
const ID2 = '01a1f5d7-4c88-7b8d-8d9f-2551c9cb89e2';
const ID3 = '01a1f5d7-4c88-7b8d-8d9f-2551c9cb89e3';
const file = (n: string) => new File(['x'], n, { type: 'image/png' });
const saved = (id: string, seq: number): MediaItem => ({ id, type: 'image', name: id, url: `https://x/${id}`, previewUrl: `https://x/${id}`, sequence: seq, file: null });
const fresh = (n: string, seq: number): MediaItem => ({ id: `local-${n}`, type: 'image', name: n, url: 'blob:x', previewUrl: 'blob:x', sequence: seq, file: file(n) });

describe('HttpLessonMediaRepository', () => {
  let repo: HttpLessonMediaRepository;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repo = TestBed.inject(HttpLessonMediaRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('reads saved media as items with no local file', async () => {
    const a = repo.get('s1');
    http.expectOne(`${base}/signs/s1/media`).flush([
      { id: ID1, type: 'image', name: 'a.png', url: 'https://x/a', sequence: 1 },
      { id: ID2, type: 'video', name: 'v.mp4', url: 'https://x/v', sequence: null },
    ]);
    const items = await a;
    expect(items.map((i) => [i.id, i.type, i.sequence, i.file])).toEqual([[ID1, 'image', 1, null], [ID2, 'video', null, null]]);
    expect(items[0].previewUrl).toBe('https://x/a');
  });

  it('sends the final order: saved pictures by id, only new files as uploads', async () => {
    const video: MediaItem = { id: ID3, type: 'video', name: 'v.mp4', url: 'https://x/v', previewUrl: '', sequence: null, file: null };
    const a = repo.save('s1', [saved(ID2, 1), fresh('new.png', 2), saved(ID1, 3), video]);
    const r = http.expectOne(`${base}/signs/s1/media`);
    const f = r.request.body as FormData;
    expect(f.getAll('order[]')).toEqual([`keep:${ID2}`, 'new:0', `keep:${ID1}`]);
    expect(f.getAll('pictures[]').length).toBe(1);
    expect((f.getAll('pictures[]')[0] as File).name).toBe('new.png');
    expect(f.get('keepVideo')).toBe('1');
    expect(f.has('video')).toBe(false);
    r.flush([]);
    await a;
  });

  it('uploads a new video and numbers several new pictures in order', async () => {
    const vid: MediaItem = { id: 'local-v', type: 'video', name: 'v.mp4', url: 'blob:v', previewUrl: '', sequence: null, file: new File(['v'], 'v.mp4', { type: 'video/mp4' }) };
    const a = repo.save('s1', [fresh('a.png', 1), fresh('b.png', 2), vid]);
    const r = http.expectOne(`${base}/signs/s1/media`);
    const f = r.request.body as FormData;
    expect(f.getAll('order[]')).toEqual(['new:0', 'new:1']);
    expect(f.getAll('pictures[]').map((x) => (x as File).name)).toEqual(['a.png', 'b.png']);
    expect((f.get('video') as File).name).toBe('v.mp4');
    expect(f.has('keepVideo')).toBe(false);
    r.flush([]);
    await a;
  });

  it('skips a placeholder that the server never made, and sends nothing when nothing is real', async () => {
    const placeholder: MediaItem = { id: 'current', type: 'image', name: 'Current picture', url: 'https://x/old', previewUrl: 'https://x/old', sequence: 1, file: null };
    await repo.save('s1', [placeholder]);
    http.expectNone(`${base}/signs/s1/media`);

    const a = repo.save('s1', [placeholder, fresh('n.png', 2)]);
    const r = http.expectOne(`${base}/signs/s1/media`);
    expect((r.request.body as FormData).getAll('order[]')).toEqual(['new:0']);
    r.flush([]);
    await a;
  });

  it('shows the server\'s message when a save fails', async () => {
    const a = repo.save('s1', [fresh('n.png', 1)]);
    http.expectOne(`${base}/signs/s1/media`).flush({ message: 'Add at least one picture.', errors: { order: ['Add at least one picture.'] } }, { status: 422, statusText: 'Unprocessable' });
    await expect(a).rejects.toMatchObject({ status: 422 });
  });

  it('removes all media of a sign', async () => {
    const a = repo.remove('s1');
    const r = http.expectOne(`${base}/signs/s1/media`);
    expect(r.request.method).toBe('DELETE');
    r.flush(null, { status: 204, statusText: 'No Content' });
    await a;
  });
});
