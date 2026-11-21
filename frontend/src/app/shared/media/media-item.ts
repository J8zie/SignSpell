/** One picture or video attached to a word/sentence, with its file and place in the order. */
export interface MediaItem {
  /** Unique id made in the browser, used to keep the right card when the order changes. */
  id: string;
  type: 'image' | 'video';
  /** Original file name, shown on the card so the teacher can tell pictures apart. */
  name: string;
  /** Address the browser can show right now (a temporary local address). The backend will return a permanent URL. */
  url: string;
  /** Address of the small picture shown on the card (the same as `url` for pictures). */
  previewUrl: string;
  /** Place in the picture sequence, starting at 1 (1 is the start image). Always null for the video. */
  sequence: number | null;
  /** The chosen file, kept so it can be uploaded when the backend is connected. */
  file: File | null;
}
