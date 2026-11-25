// Видео за портретом: любой файл человека (гифка, картинка, mp4, webm) → webm, который играет Panorama.
// Готовый webm кладём как есть, остальное перерисовываем в canvas и записываем MediaRecorder'ом.
// Запись идёт в реальном времени, поэтому длина ограничена.

export const MAX_SIDE = 720; // как у шаблона, проверенного в игре (736×736)
export const MAX_SECONDS = 15;
export const STILL_SECONDS = 2; // картинку без анимации пишем коротким видео: в игре оно крутится по кругу
const FPS = 30;
const BITRATE = 3_000_000;
const MAX_FRAMES = 600;
const MIME_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
const GIF_MIN_DELAY_MS = 100; // браузеры показывают кадр с задержкой 0–10 мс как 100 мс

export class VideoError extends Error {}

/** Длина одного круга гифки в мс по задержкам кадров. 0 — не гифка или в ней один кадр. */
export function gifDuration(bytes) {
  const b = bytes;
  if (b.length < 13 || String.fromCharCode(...b.subarray(0, 3)) !== 'GIF') return 0;
  let pos = 13;
  if (b[10] & 0x80) pos += 3 * (2 << (b[10] & 7));
  const skipBlocks = () => { while (pos < b.length && b[pos] !== 0) pos += b[pos] + 1; pos += 1; };
  let total = 0;
  let frames = 0;
  let delay = 0;
  while (pos < b.length) {
    const kind = b[pos];
    if (kind === 0x3b) break;
    if (kind === 0x21) {
      if (b[pos + 1] === 0xf9 && pos + 5 < b.length) delay = (b[pos + 4] | (b[pos + 5] << 8)) * 10;
      pos += 2;
      skipBlocks();
    } else if (kind === 0x2c) {
      frames += 1;
      total += delay <= 10 ? GIF_MIN_DELAY_MS : delay;
      delay = 0;
      const packed = b[pos + 9];
      pos += 10;
      if (packed & 0x80) pos += 3 * (2 << (packed & 7));
      pos += 1; // наименьший размер кода LZW
      skipBlocks();
    } else {
      break; // повреждённый файл: что успели прочитать
    }
  }
  return frames > 1 ? total : 0;
}

// --- Длина в заголовке webm. MediaRecorder её не пишет, а без неё плееры не знают длину ролика.

const SEGMENT = 0x18538067;
const INFO = 0x1549a966;
const DURATION = 0x4489;

function readId(b, pos) {
  const first = b[pos];
  const length = first >= 0x80 ? 1 : first >= 0x40 ? 2 : first >= 0x20 ? 3 : first >= 0x10 ? 4 : 0;
  if (!length) return null;
  let id = 0;
  for (let i = 0; i < length; i++) id = id * 256 + b[pos + i];
  return { id, length };
}

function readSize(b, pos) {
  const first = b[pos];
  let length = 1;
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length += 1;
  if (length > 8) return null;
  let value = first & (0xff >> length);
  let unknown = value === (0xff >> length);
  for (let i = 1; i < length; i++) {
    value = value * 256 + b[pos + i];
    if (b[pos + i] !== 0xff) unknown = false;
  }
  return { value: unknown ? -1 : value, length };
}

function sizeBytes(value) {
  const out = new Uint8Array(8);
  out[0] = 0x01;
  for (let i = 7, v = value; i >= 1; i--, v = Math.floor(v / 256)) out[i] = v & 0xff;
  return out;
}

/** Тот же webm, но с длительностью в Segment/Info (если её там нет). ms — длина ролика. */
export function withDuration(bytes, ms) {
  const b = bytes;
  let pos = 0;
  const header = readId(b, pos);
  if (!header || header.id !== 0x1a45dfa3) return bytes;
  const headerSize = readSize(b, header.length);
  pos = header.length + headerSize.length + headerSize.value;
  const segment = readId(b, pos);
  if (!segment || segment.id !== SEGMENT) return bytes;
  const segmentSize = readSize(b, pos + segment.length);
  pos += segment.length + segmentSize.length;
  while (pos < b.length) {
    const el = readId(b, pos);
    const size = el && readSize(b, pos + el.length);
    if (!el || !size || size.value < 0) return bytes;
    const body = pos + el.length + size.length;
    if (el.id === INFO) {
      for (let p = body; p < body + size.value;) {
        const child = readId(b, p);
        const childSize = child && readSize(b, p + child.length);
        if (!child || !childSize) return bytes;
        if (child.id === DURATION) return bytes;
        p += child.length + childSize.length + childSize.value;
      }
      const duration = new Uint8Array(11);
      duration.set([0x44, 0x89, 0x88]);
      new DataView(duration.buffer).setFloat64(3, ms);
      const content = b.subarray(body, body + size.value);
      const info = new Uint8Array(4 + 8 + content.length + duration.length);
      info.set([0x15, 0x49, 0xa9, 0x66]);
      info.set(sizeBytes(content.length + duration.length), 4);
      info.set(content, 12);
      info.set(duration, 12 + content.length);
      if (segmentSize.value >= 0) return bytes; // размер сегмента известен: не трогаем, чтобы не сломать
      const out = new Uint8Array(b.length - (body + size.value - pos) + info.length);
      out.set(b.subarray(0, pos));
      out.set(info, pos);
      out.set(b.subarray(body + size.value), pos + info.length);
      return out;
    }
    pos = body + size.value;
  }
  return bytes;
}

// --- Запись

const isWebmFile = (file) => file.type === 'video/webm' || /\.webm$/i.test(file.name || '');

function fitSize(width, height) {
  const ratio = Math.min(1, MAX_SIDE / Math.max(width, height));
  const even = (n) => Math.max(2, Math.round((n * ratio) / 2) * 2); // VP9 любит чётные размеры
  return [even(width), even(height)];
}

function waitFor(target, ok, fail = 'error') {
  return new Promise((resolve, reject) => {
    target.addEventListener(ok, () => resolve(), { once: true });
    target.addEventListener(fail, () => reject(new VideoError('decode')), { once: true });
  });
}

async function loadVideo(url) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  await waitFor(video, 'loadeddata');
  if (!video.videoWidth) throw new VideoError('decode');
  return video;
}

/** Кадры картинки: [{ image, ms }]. Анимированная гифка — через ImageDecoder, иначе один кадр. */
async function imageFrames(file, bytes) {
  if ('ImageDecoder' in window && gifDuration(bytes)) {
    try {
      const decoder = new window.ImageDecoder({ data: bytes, type: file.type || 'image/gif' });
      await decoder.tracks.ready;
      const count = Math.min(decoder.tracks.selectedTrack.frameCount, MAX_FRAMES);
      const frames = [];
      for (let i = 0; i < count; i++) {
        const { image } = await decoder.decode({ frameIndex: i });
        const ms = image.duration ? image.duration / 1000 : 0;
        frames.push({ image: await createImageBitmap(image), ms: ms <= 10 ? GIF_MIN_DELAY_MS : ms });
        image.close();
      }
      decoder.close();
      if (frames.length) return frames;
    } catch { /* ниже — запасной путь */ }
  }
  const image = await createImageBitmap(file).catch(() => { throw new VideoError('decode'); });
  return [{ image, ms: 0 }];
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined') throw new VideoError('recorder');
  const type = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new VideoError('recorder');
  return type;
}

/** Пишет canvas в webm, пока draw(время в мс) возвращает true. */
function record(canvas, seconds, draw, onProgress) {
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: pickMime(), videoBitsPerSecond: BITRATE });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  return new Promise((resolve, reject) => {
    recorder.onerror = () => reject(new VideoError('recorder'));
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const raw = new Uint8Array(await new Blob(chunks).arrayBuffer());
      resolve(new Blob([withDuration(raw, Math.round(seconds * 1000))], { type: 'video/webm' }));
    };
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const going = elapsed < seconds * 1000 && draw(elapsed);
      if (onProgress) onProgress(Math.min(1, elapsed / (seconds * 1000)));
      if (going) setTimeout(tick, 1000 / FPS);
      else recorder.stop();
    };
    draw(0);
    recorder.start(250);
    setTimeout(tick, 1000 / FPS);
  });
}

async function fromImage(file, onProgress) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const frames = await imageFrames(file, bytes);
  const [width, height] = fitSize(frames[0].image.width, frames[0].image.height);
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d');
  const loop = frames.reduce((sum, f) => sum + f.ms, 0);
  // Короткую гифку пишем несколькими кругами, но всегда целыми: тогда стык в игре не виден.
  const loops = loop ? Math.max(1, Math.min(Math.floor((MAX_SECONDS * 1000) / loop), Math.ceil(1000 / loop))) : 0;
  const seconds = loop ? (loop * loops) / 1000 : STILL_SECONDS;
  if (loop > MAX_SECONDS * 1000) throw new VideoError('long');
  const frameAt = (ms) => {
    if (!loop) return frames[0].image;
    let t = ms % loop;
    for (const f of frames) { if (t < f.ms) return f.image; t -= f.ms; }
    return frames[frames.length - 1].image;
  };
  const blob = await record(canvas, seconds, (ms) => {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(frameAt(ms), 0, 0, width, height);
    return true;
  }, onProgress);
  frames.forEach((f) => f.image.close?.());
  return { blob, width, height, seconds };
}

async function fromVideo(file, onProgress) {
  const url = URL.createObjectURL(file);
  try {
    const video = await loadVideo(url);
    const seconds = Math.min(Number.isFinite(video.duration) ? video.duration : MAX_SECONDS, MAX_SECONDS);
    const [width, height] = fitSize(video.videoWidth, video.videoHeight);
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d');
    await video.play();
    const blob = await record(canvas, seconds, () => {
      ctx.drawImage(video, 0, 0, width, height);
      return !video.ended;
    }, onProgress);
    video.pause();
    return { blob, width, height, seconds };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Готовый webm проверяем, что браузер его открывает, и берём без перекодирования. */
async function asIs(file) {
  const url = URL.createObjectURL(file);
  try {
    const video = await loadVideo(url);
    return { blob: new Blob([file], { type: 'video/webm' }), width: video.videoWidth, height: video.videoHeight,
      seconds: Number.isFinite(video.duration) ? video.duration : 0 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Файл человека → { blob: webm, width, height, seconds }. onProgress(0…1) — ход записи.
 * Ошибки — VideoError с кодом: decode (не открылся), recorder (браузер не умеет писать webm), long.
 */
export async function fileToWebm(file, onProgress) {
  if (isWebmFile(file)) return asIs(file);
  if (file.type.startsWith('image/')) return fromImage(file, onProgress);
  if (file.type.startsWith('video/')) return fromVideo(file, onProgress);
  throw new VideoError('decode');
}
