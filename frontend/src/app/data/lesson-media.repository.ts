import { MediaItem } from '../shared/media/media-item';

/** The one place screens read and write a word/sentence's extra pictures and video; the HTTP implementation talks to the Laravel API. */
export abstract class LessonMediaRepository {
  /** The saved media of a sign, already in sequence order (empty when there is none). */
  abstract get(signId: string): Promise<MediaItem[]>;
  /** Replaces the media of a sign with this ordered list. */
  abstract save(signId: string, items: MediaItem[]): Promise<void>;
  /** Forgets the media of a sign. */
  abstract remove(signId: string): Promise<void>;
}
