import { beforeEach, expect, it, vi } from 'vitest';
import { startPickerSession } from '../inspect-save/picker-session';
import { isContextPayload, startBrowserContextSession } from './session';
import { samplePayload } from './test-fixtures';

vi.mock('../inspect-save/picker-session', () => ({
  startPickerSession: vi.fn(async () => ({ close: vi.fn(), sendCommand: vi.fn() })),
}));

beforeEach(() => vi.clearAllMocks());

it('validates context payloads', () => {
  expect(isContextPayload(samplePayload())).toBe(true);
  expect(isContextPayload({})).toBe(false);
  expect(isContextPayload({ ...samplePayload(), css: undefined })).toBe(false);
  expect(isContextPayload({ ...samplePayload(), selectors: undefined })).toBe(false);
  expect(isContextPayload(null)).toBe(false);
});

it('starts an optional-screenshot session and maps the png', async () => {
  const handlers = { onStatus: vi.fn(), onResult: vi.fn(), onEnd: vi.fn(), onLocked: vi.fn() };
  const signal = new AbortController().signal;
  await startBrowserContextSession(1, 10, signal, handlers);
  const options = vi.mocked(startPickerSession).mock.calls[0]![0];
  expect(options).toMatchObject({
    tabId: 1,
    windowId: 10,
    signal,
    file: '/browser-context.js',
    portPrefix: 'swiss-browser-context',
    toolName: 'Browser context',
    screenshot: 'optional',
  });

  const payload = samplePayload();
  options.onResult(payload, { png: 'data:image/png;base64,abc', clipped: false });
  expect(handlers.onResult).toHaveBeenCalledWith({ ...payload, png: 'data:image/png;base64,abc' }, undefined);
  options.onResult(payload, null, 'boom');
  expect(handlers.onResult).toHaveBeenLastCalledWith({ ...payload, png: undefined }, 'boom');
});
