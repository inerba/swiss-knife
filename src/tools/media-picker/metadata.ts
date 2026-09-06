import { browser } from 'wxt/browser';
import type { MediaCandidate, MediaDetails, MediaKind } from './types';
import { boundedBlob } from './file';
import { mediaKind } from './format';

const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'image/x-icon': 'ico' };
Object.assign(extensions, { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/flac': 'flac', 'text/vtt': 'vtt', 'application/vnd.apple.mpegurl': 'm3u8', 'application/dash+xml': 'mpd' });
export function filenameFor(url: string, mime?: string | null, id = '1') {
  let name = '';
  try { if (/^https?:/.test(url)) name = decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); } catch { /* Use a generated name. */ }
  name = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 160);
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
  if (!name) name = `file-${id}`;
  const ext = mime && extensions[mime];
  if (ext && !/\.[a-z\d]{1,8}$/i.test(name)) name += `.${ext}`;
  return name;
}
export function formatBytes(bytes: number | null) {
  if (bytes === null) return 'Non disponibile';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB'];
  const power = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(bytes / 1024 ** power)} ${units[power - 1]}`;
}
export function initialDetails(image: MediaCandidate): MediaDetails {
  const filename = filenameFor(image.url, null, image.id);
  return { filename, extension: filename.match(/\.([a-z\d]{1,8})$/i)?.[1]?.toUpperCase() || null, mime: null, width: image.width, height: image.height, size: null, verified: false, kind: image.kind || 'image', duration: image.duration ?? null };
}
async function mediaDimensions(url: string, kind: 'video' | 'audio', signal: AbortSignal) {
  return new Promise<{ width: number | null; height: number | null; duration: number | null }>((resolve, reject) => {
    const media = document.createElement(kind);
    media.preload = 'metadata';
    const cleanup = () => { signal.removeEventListener('abort', abort); media.onloadedmetadata = null; media.onerror = null; media.removeAttribute('src'); media.load(); };
    const abort = () => { cleanup(); reject(signal.reason); };
    media.onloadedmetadata = () => {
      const result = { width: kind === 'video' ? (media as HTMLVideoElement).videoWidth || null : null, height: kind === 'video' ? (media as HTMLVideoElement).videoHeight || null : null, duration: Number.isFinite(media.duration) ? media.duration : null };
      cleanup(); resolve(result);
    };
    media.onerror = () => { cleanup(); reject(new Error('Codec non riproducibile dal browser. Il file originale resta scaricabile.')); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort(); else media.src = url;
  });
}
async function dimensions(url: string, signal: AbortSignal) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    const cleanup = () => { signal.removeEventListener('abort', abort); image.onload = null; image.onerror = null; };
    const abort = () => { cleanup(); image.src = ''; reject(signal.reason); };
    image.onload = () => { cleanup(); resolve({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { cleanup(); reject(new Error('Formato non decodificabile dal browser.')); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort(); else image.src = url;
  });
}
export async function readDetails(image: MediaCandidate, signal: AbortSignal, readBlob: (id: string) => Promise<string>): Promise<MediaDetails> {
  const details = initialDetails(image);
  const timed = AbortSignal.any([signal, AbortSignal.timeout(20000)]);
  let objectUrl: string | undefined;
  try {
    let url = image.url;
    if (url.startsWith('blob:')) url = await readBlob(image.id);
    timed.throwIfAborted();
    let response: Response;
    try {
      response = await fetch(url, { signal: timed, credentials: 'omit', redirect: 'error' });
    } catch (error) {
      if (/^https?:/.test(url) && !timed.aborted) {
        const permission = `${new URL(url).origin}/*`;
        if (!await browser.permissions.contains({ origins: [permission] })) {
          return { ...details, permission, error: 'Per completare i metadati, autorizza il dominio del file.' };
        }
      }
      throw error;
    }
    const blob = await boundedBlob(response, timed);
    details.size = blob.size;
    details.mime = blob.type || null;
    const kind: MediaKind = mediaKind(image.url, blob.type) || image.kind || 'image';
    details.kind = kind;
    if (/^(text\/html|application\/json)/i.test(blob.type)) throw new Error('La risposta non è un file multimediale. Potrebbe richiedere autenticazione.');
    objectUrl = URL.createObjectURL(blob);
    details.filename = filenameFor(image.url, details.mime, image.id);
    details.extension = details.filename.match(/\.([a-z\d]{1,8})$/i)?.[1]?.toUpperCase() || null;
    if (kind === 'stream' || kind === 'subtitle') return { ...details, blob, objectUrl, notice: kind === 'stream' ? 'È una playlist, non il video completo. I segmenti e i contenuti protetti non vengono ricostruiti.' : undefined };
    try {
      const size = kind === 'image' ? await dimensions(objectUrl, timed) : await mediaDimensions(objectUrl, kind, timed);
      return { ...details, ...size, verified: true, blob, objectUrl };
    } catch (error) {
      signal.throwIfAborted();
      return { ...details, blob, objectUrl, notice: error instanceof Error ? error.message : 'Anteprima non disponibile. Il file originale resta scaricabile.' };
    }
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    signal.throwIfAborted();
    return { ...details, error: timed.aborted ? 'Tempo scaduto nel recupero dei metadati. Riprova.' : error instanceof TypeError ? 'File non recuperabile: rete, autenticazione o redirect. Puoi aprire l’originale.' : error instanceof Error ? error.message : String(error) };
  }
}
