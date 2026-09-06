import type { MediaKind } from './types';
export const mediaLabels: Record<MediaKind, string> = { image: 'Immagine', video: 'Video', audio: 'Audio', subtitle: 'Sottotitoli', stream: 'Playlist streaming' };
export function compactPageUrl(value: string) {
  try { const url = new URL(value); return `${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`; }
  catch { return value; }
}
export function mediaKind(url: string, mime = ''): MediaKind | undefined {
  if (/mpegurl|dash\+xml/i.test(mime) || /\.(m3u8?|mpd)(?:[?#]|$)/i.test(url)) return 'stream';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico|tiff?|heic)(?:[?#]|$)/i.test(url)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv|mkv|avi|mpeg|mpg)(?:[?#]|$)/i.test(url)) return 'video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|aiff)(?:[?#]|$)/i.test(url)) return 'audio';
  if (/vtt|subrip/i.test(mime) || /\.(vtt|srt)(?:[?#]|$)/i.test(url)) return 'subtitle';
}
export function formatDuration(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return 'Non disponibile';
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
