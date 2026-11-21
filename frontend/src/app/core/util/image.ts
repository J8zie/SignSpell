export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Returns an error message, or null when the file is acceptable. */
export function imageProblem(file: File): string | null {
  if (!TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP picture.';
  if (file.size > MAX_IMAGE_BYTES) return 'The picture is larger than 2 MB.';
  return null;
}
