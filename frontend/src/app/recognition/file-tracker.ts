import { Pt } from './landmarks';
import { CameraError, createHands, HandsApi, HandsResults } from './sources';

/** One extracted frame: 21 points for one hand, or 42 (two hands concatenated, right hand first) — same layout as the seeded word samples. */
export type LandmarkFrame = Pt[];
export interface ExtractedSequence { frames: LandmarkFrame[]; }

const MAX_FRAMES = 600;
const TARGET_FPS = 10;

/** Reads landmarks out of an uploaded picture or video using the same MediaPipe Hands bundle as the camera. */
export class FileTracker {
  private hands: HandsApi | null = null;
  private latest: HandsResults | null = null;

  // Loads the hand tracker once; reuse the same FileTracker for several files.
  async init(): Promise<void> {
    if (!this.hands) this.hands = await createHands((r) => { this.latest = r; }, 2);
  }

  // Stops the tracker and frees its GPU resources.
  close(): void {
    const h = this.hands;
    this.hands = null;
    void h?.close().catch(() => undefined);
  }

  // Extracts landmarks: a single frame for a picture, a timed sequence for a video.
  async extract(file: File): Promise<ExtractedSequence> {
    if (!this.hands) await this.init();
    if (!this.hands) throw new CameraError('tracker', 'Hand tracking could not start.');
    return file.type.startsWith('video/') ? this.fromVideo(file) : this.fromImage(file);
  }

  // Draws an image file to a canvas and tracks the hand(s) in it.
  private async fromImage(file: File): Promise<ExtractedSequence> {
    const bitmap = await createImageBitmap(file);
    try {
      const frame = await this.track(bitmap);
      if (!frame.length) throw new CameraError('tracker', 'No hand was found in this picture. Use a clearer photo with one or two hands visible.');
      return { frames: [this.join(frame)] };
    } finally {
      bitmap.close();
    }
  }

  // Steps through the video at ~10 fps, tracking hands on each frame and keeping only frames where a hand is visible.
  private async fromVideo(file: File): Promise<ExtractedSequence> {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    const frames: LandmarkFrame[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new CameraError('tracker', 'This video could not be read.', file.name));
      });
      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) throw new CameraError('tracker', 'This video has no readable duration.');
      const step = Math.max(1 / TARGET_FPS, duration / MAX_FRAMES);
      const canvas = document.createElement('canvas');
      for (let t = 0; t < duration && frames.length < MAX_FRAMES; t += step) {
        await this.seek(video, Math.min(t, duration - 0.05));
        const hands = await this.track(video);
        if (hands.length) frames.push(this.join(hands));
      }
      if (!frames.length) throw new CameraError('tracker', 'No hand was found in this video. Use a clearer video with hands visible.');
      return { frames };
    } finally {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
    }
  }

  // Jumps the video to a time and waits until that frame is ready to draw.
  private seek(video: HTMLVideoElement, t: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => { video.removeEventListener('seeked', done); resolve(); };
      video.addEventListener('seeked', done);
      video.currentTime = t;
      // Some browsers fire seeked before the listener attaches on tiny seeks; poll as a fallback.
      setTimeout(done, 500);
    });
  }

  // Sends one picture to MediaPipe and returns the detected hands (each 21 points).
  private async track(image: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Pt[][]> {
    this.latest = null;
    const canvas = document.createElement('canvas');
    const w = (image as HTMLVideoElement).videoWidth || (image as HTMLCanvasElement).width || (image as ImageBitmap).width;
    const h = (image as HTMLVideoElement).videoHeight || (image as HTMLCanvasElement).height || (image as ImageBitmap).height;
    if (!w || !h) return [];
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')?.drawImage(image as CanvasImageSource, 0, 0);
    await this.hands!.send({ image: canvas });
    await new Promise((r) => setTimeout(r, 30)); // let onResults land
    const res = this.latest as HandsResults | null; // onResults fills this asynchronously; TS cannot see that
    return (res?.multiHandLandmarks ?? []).slice(0, 2).map((hand: Pt[]) => hand.map((p: Pt) => ({ x: p.x, y: p.y, z: p.z })));
  }

  // Flattens detected hands into one frame: right hand first, then left (42 points) — matching the seeded word format.
  private join(hands: Pt[][]): LandmarkFrame {
    const pts = hands.flatMap((hand) => hand);
    return pts.length === 21 ? pts : pts.slice(0, 42);
  }
}
