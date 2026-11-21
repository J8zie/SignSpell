// Downloads the MediaPipe hand model so you can host it yourself: npm run fetch-model
import { createWriteStream, mkdirSync } from 'node:fs';
import https from 'node:https';

const URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
mkdirSync('public/models', { recursive: true });
https.get(URL, (res) => {
  if (res.statusCode !== 200) { console.error('Download failed:', res.statusCode); process.exit(1); }
  res.pipe(createWriteStream('public/models/hand_landmarker.task')).on('finish', () => console.log('Saved public/models/hand_landmarker.task. Set handModelUrl to "models/hand_landmarker.task".'));
}).on('error', (e) => { console.error(e.message); process.exit(1); });
