import { expect, it } from 'vitest';
import { boundedBlob } from './file';
import { MAX_MEDIA_BYTES } from './types';
it('measures bytes actually received instead of trusting a missing length header', async () => {
  const response = new Response(new Uint8Array([1, 2, 3, 4, 5]), { headers: { 'content-type': 'image/png' } });
  const blob = await boundedBlob(response, new AbortController().signal);
  expect(blob.size).toBe(5); expect(blob.type).toBe('image/png');
});
it('rejects an oversized response before reading its body', async () => {
  const response = new Response('small', { headers: { 'content-length': String(MAX_MEDIA_BYTES + 1) } });
  await expect(boundedBlob(response, new AbortController().signal)).rejects.toThrow('32 MiB');
});
