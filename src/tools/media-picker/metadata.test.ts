import { afterEach, expect, it, vi } from 'vitest';
import { filenameFor, formatBytes, readDetails } from './metadata';
const api = vi.hoisted(() => ({ permissions: { contains: vi.fn() } }));
vi.mock('wxt/browser', () => ({ browser: api }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const image = { id: '1', url: 'https://cdn.test/photo.png', sources: ['Immagine'], width: 800, height: 600 };
it('formats exact zero and unknown size differently, with readable binary units', () => {
  expect(formatBytes(null)).toBe('Non disponibile'); expect(formatBytes(0)).toBe('0 B');
  expect(formatBytes(1536)).toBe('1,5 KiB');
});
it('sanitizes filenames, preserves legitimate extensions and derives missing extensions from MIME', () => {
  expect(filenameFor('https://test/CON.png')).toBe('_CON.png');
  expect(filenameFor('https://test/a%2Fb%3F.png')).toBe('a_b_.png');
  expect(filenameFor('data:image/png;base64,', 'image/png')).toBe('file-1.png');
  expect(filenameFor('https://test/photo?token=secret', 'image/webp')).toBe('photo.webp');
});
it('requests only the affected origin after a blocked fetch and retains page dimensions', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  api.permissions.contains.mockResolvedValue(false);
  const result = await readDetails(image, new AbortController().signal, vi.fn());
  expect(result).toMatchObject({ permission: 'https://cdn.test/*', width: 800, height: 600, size: null, verified: false });
  expect(api.permissions.contains).toHaveBeenCalledWith({ origins: ['https://cdn.test/*'] });
});
it('does not ask repeatedly when a granted origin fails because of a redirect or network error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  api.permissions.contains.mockResolvedValue(true);
  const result = await readDetails(image, new AbortController().signal, vi.fn());
  expect(result.permission).toBeUndefined(); expect(result.error).toContain('redirect');
});
it('reports HTTP errors without inventing file sizes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('No', { status: 403 })));
  const result = await readDetails(image, new AbortController().signal, vi.fn());
  expect(result.size).toBeNull(); expect(result.error).toContain('403');
});
it('does not publish metadata after cancellation', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(readDetails(image, controller.signal, vi.fn())).rejects.toThrow();
});
