import { MediaItem } from './media-item';

/** Pure functions that reorder, add, and remove media items; each returns a new list. */

/** The pictures only, in the order the learner will see them. */
export const imagesOf = (items: MediaItem[]): MediaItem[] => items.filter((m) => m.type === 'image');

/** The one video, if there is one. */
export const videoOf = (items: MediaItem[]): MediaItem | null => items.find((m) => m.type === 'video') ?? null;

/** Puts the pictures first (in order, numbered from 1) and the video last, so `sequence` always matches the position. */
export function renumber(items: MediaItem[]): MediaItem[] {
  const pics = imagesOf(items).map((m, i) => ({ ...m, sequence: i + 1 }));
  const vid = videoOf(items);
  return vid ? [...pics, { ...vid, sequence: null }] : pics;
}

/** Adds pictures at the end of the sequence. */
export const addImages = (items: MediaItem[], added: MediaItem[]): MediaItem[] => renumber([...imagesOf(items), ...added, ...(videoOf(items) ? [videoOf(items)!] : [])]);

/** Sets the video. A teacher can attach only one, so a new video replaces the old one. */
export const setVideo = (items: MediaItem[], video: MediaItem | null): MediaItem[] => renumber([...imagesOf(items), ...(video ? [video] : [])]);

/** Removes one item (picture or video) and closes the gap in the numbering. */
export const removeItem = (items: MediaItem[], id: string): MediaItem[] => renumber(items.filter((m) => m.id !== id));

/** Moves a picture to a new place in the sequence (used by drag and drop and by the earlier/later buttons). */
export function moveImage(items: MediaItem[], id: string, toIndex: number): MediaItem[] {
  const pics = imagesOf(items);
  const from = pics.findIndex((m) => m.id === id);
  if (from < 0) return items;
  const to = Math.max(0, Math.min(pics.length - 1, toIndex));
  if (from === to) return items;
  const [moved] = pics.splice(from, 1);
  pics.splice(to, 0, moved);
  return renumber([...pics, ...(videoOf(items) ? [videoOf(items)!] : [])]);
}

/** Makes a picture the starting picture (first in the sequence). */
export const makeStart = (items: MediaItem[], id: string): MediaItem[] => moveImage(items, id, 0);

/** What a card in the sequence should say: where the learner starts, what comes next, and where it ends. */
export function stepRole(index: number, total: number): 'only' | 'start' | 'next' | 'final' {
  if (total <= 1) return 'only';
  if (index === 0) return 'start';
  return index === total - 1 ? 'final' : 'next';
}
