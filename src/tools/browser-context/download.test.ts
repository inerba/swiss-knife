import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  downloads: {
    download: vi.fn(),
    search: vi.fn(),
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}));
vi.mock('wxt/browser', () => ({ browser: api }));

import { downloadReport, waitForDownload } from './download';
import { samplePayload } from './test-fixtures';

const texts: string[] = [];
class FakeBlob {
  constructor(parts: string[]) {
    texts.push(parts.join(''));
  }
}

const now = new Date(2026, 8, 16, 14, 30, 12);

beforeEach(() => {
  vi.clearAllMocks();
  texts.length = 0;
  vi.stubGlobal('Blob', FakeBlob);
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:report'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('saves the png first and links its final file name in the report', async () => {
  api.downloads.download.mockResolvedValueOnce(7).mockResolvedValueOnce(8);
  api.downloads.search.mockResolvedValue([{
    id: 7,
    state: 'complete',
    filename: 'C:\\Users\\me\\Downloads\\swiss-knife\\browser-context\\card-20260916-143012 (1).png',
  }]);
  const outcome = await downloadReport({ ...samplePayload(), png: 'data:image/png;base64,abc' }, now);
  expect(outcome).toBe('complete');
  expect(api.downloads.download).toHaveBeenNthCalledWith(1, {
    url: 'data:image/png;base64,abc',
    filename: 'swiss-knife/browser-context/card-20260916-143012.png',
    saveAs: false,
    conflictAction: 'uniquify',
  });
  expect(api.downloads.download).toHaveBeenNthCalledWith(2, {
    url: 'blob:report',
    filename: 'swiss-knife/browser-context/card-20260916-143012.md',
    saveAs: false,
    conflictAction: 'uniquify',
  });
  expect(texts[0]).toContain('![Screenshot of div.card](<card-20260916-143012 (1).png>)');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
});

it('saves only the report when there is no screenshot', async () => {
  api.downloads.download.mockResolvedValueOnce(9);
  const outcome = await downloadReport(samplePayload(), now);
  expect(outcome).toBe('no-screenshot');
  expect(api.downloads.download).toHaveBeenCalledTimes(1);
  expect(texts[0]).not.toContain('![Screenshot');
});

it('saves the report without image when the png download is interrupted', async () => {
  api.downloads.download.mockResolvedValueOnce(7).mockResolvedValueOnce(8);
  api.downloads.search.mockResolvedValue([{ id: 7, state: 'in_progress', filename: '' }]);
  api.downloads.onChanged.addListener.mockImplementation((listener: (delta: unknown) => void) => {
    queueMicrotask(() => listener({ id: 7, state: { current: 'interrupted' } }));
  });
  const outcome = await downloadReport({ ...samplePayload(), png: 'data:image/png;base64,abc' }, now);
  expect(outcome).toBe('screenshot-failed');
  expect(texts[0]).not.toContain('![Screenshot');
  expect(api.downloads.onChanged.removeListener).toHaveBeenCalled();
});

it('gives up waiting after the timeout', async () => {
  vi.useFakeTimers();
  api.downloads.search.mockResolvedValue([{ id: 3, state: 'in_progress' }]);
  const waiting = waitForDownload(3, 50);
  await vi.advanceTimersByTimeAsync(60);
  await expect(waiting).resolves.toBe(false);
});
