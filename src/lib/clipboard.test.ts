import { afterEach, expect, it, vi } from 'vitest';
import { installClipboardFallback } from './clipboard';

afterEach(() => vi.restoreAllMocks());

it('falls back to the copy command when the Clipboard API is denied, and keeps the focus', async () => {
  const clipboard = { writeText: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) } as unknown as Clipboard;
  const copied: string[] = [];
  Object.assign(document, { execCommand: vi.fn(() => { copied.push((document.activeElement as HTMLTextAreaElement).value); return true; }) });
  const button = document.createElement('button'); document.body.append(button); button.focus();
  installClipboardFallback(clipboard);
  await clipboard.writeText('ciao');
  expect(copied).toEqual(['ciao']);
  expect(document.activeElement).toBe(button);
  expect(document.querySelector('textarea')).toBeNull();
});

it('reports the original error when the command fails too', async () => {
  const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } as unknown as Clipboard;
  Object.assign(document, { execCommand: vi.fn(() => false) });
  installClipboardFallback(clipboard);
  await expect(clipboard.writeText('ciao')).rejects.toThrow('Denied');
});
