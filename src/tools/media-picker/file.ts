import { MAX_MEDIA_BYTES } from './types';

export async function boundedBlob(response: Response, signal: AbortSignal): Promise<Blob> {
  if (!response.ok) throw new Error(`Il server ha risposto HTTP ${response.status}.`);
  if (Number(response.headers.get('content-length')) > MAX_MEDIA_BYTES) {
    await response.body?.cancel();
    throw new Error('File oltre 32 MiB: metadati non recuperati. Puoi scaricare l’originale.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Il server non ha restituito il file.');
  const parts: Uint8Array<ArrayBuffer>[] = []; let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MEDIA_BYTES) throw new Error('File oltre 32 MiB: metadati non recuperati. Puoi scaricare l’originale.');
      parts.push(value as Uint8Array<ArrayBuffer>);
    }
  } finally { await reader.cancel(); }
  return new Blob(parts, { type: response.headers.get('content-type')?.split(';')[0] || '' });
}
