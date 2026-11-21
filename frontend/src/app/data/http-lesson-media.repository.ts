import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { MediaItem } from '../shared/media/media-item';
import { failWith } from './http-errors';
import { LessonMediaRepository } from './lesson-media.repository';

interface ServerMedia { id: string; type: 'image' | 'video'; name: string; url: string; sequence: number | null; }

/** Only ids the server made (UUIDs) can be kept. A browser-made id, or a placeholder, always means "not saved yet". */
const isServerId = (id: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Saves a word/sentence's pictures and video on the server; kept pictures are sent by id, not re-uploaded. */
@Injectable({ providedIn: 'root' })
export class HttpLessonMediaRepository extends LessonMediaRepository {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/$/, '');

  // Loads a sign's saved media from the server in display order.
  async get(signId: string): Promise<MediaItem[]> {
    const rows = await failWith(firstValueFrom(this.http.get<ServerMedia[]>(`${this.base}/signs/${signId}/media`)));
    return rows.map<MediaItem>((m) => ({
      id: m.id, type: m.type, name: m.name, url: m.url, previewUrl: m.type === 'image' ? m.url : '', sequence: m.sequence, file: null,
    }));
  }

  // Sends the final media list: kept items by id, new files as uploads.
  async save(signId: string, items: MediaItem[]): Promise<void> {
    const form = new FormData();
    const pictures = items.filter((m) => m.type === 'image');
    const video = items.find((m) => m.type === 'video');
    let newFiles = 0;

    for (const p of pictures) {
      if (p.file) {
        form.append('order[]', `new:${newFiles}`);
        form.append('pictures[]', p.file);
        newFiles++;
      } else if (isServerId(p.id)) {
        form.append('order[]', `keep:${p.id}`);
      }
      // A picture with no file and no server id (for example a placeholder) has nothing to save, so it is skipped.
    }

    // Nothing real to send: leave what is on the server alone rather than wipe it by accident.
    if (![...form.keys()].some((k) => k === 'order[]')) return;

    if (video?.file) form.append('video', video.file);
    else if (video && isServerId(video.id)) form.append('keepVideo', '1');

    await failWith(firstValueFrom(this.http.post<ServerMedia[]>(`${this.base}/signs/${signId}/media`, form)));
  }

  // Deletes all of a sign's media from the server.
  async remove(signId: string): Promise<void> {
    await failWith(firstValueFrom(this.http.delete<void>(`${this.base}/signs/${signId}/media`)));
  }
}
