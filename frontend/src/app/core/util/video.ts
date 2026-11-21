/** A teacher may attach one short video of the sign to a word or sentence. */
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/** Returns an error message, or null when the file is acceptable (same idea as imageProblem). */
export function videoProblem(file: File): string | null {
  if (!VIDEO_TYPES.includes(file.type)) return 'Use an MP4, WebM or MOV video.';
  if (file.size > MAX_VIDEO_BYTES) return 'The video is larger than 25 MB.';
  return null;
}
