import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ScreenshotTool } from './ScreenshotTool';

const api = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() });
  return { tabs: { query: vi.fn(), captureVisibleTab: vi.fn(), onActivated: event(), onUpdated: event() }, windows: { getCurrent: vi.fn() }, scripting: { executeScript: vi.fn() }, downloads: { download: vi.fn() } };
});
vi.mock('wxt/browser', () => ({ browser: api }));
let root: Root; let host: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  api.tabs.query.mockResolvedValue([{ id: 7, windowId: 3, url: 'https://example.test/' }]);
  api.tabs.captureVisibleTab.mockResolvedValue('data:image/png;base64,AA==');
  api.downloads.download.mockResolvedValue(1); api.windows.getCurrent.mockResolvedValue({ id: 3 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<ScreenshotTool />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('downloads the visible screenshot as a PNG', async () => {
  const button = [...host.querySelectorAll('button')].find(item => item.textContent?.includes('Schermata'))!;
  await act(async () => button.click());
  expect(api.tabs.captureVisibleTab).toHaveBeenCalledWith(3, { format: 'png' });
  expect(api.downloads.download).toHaveBeenCalledWith(expect.objectContaining({ url: 'data:image/png;base64,AA==', filename: expect.stringMatching(/^screenshot-schermata-.*\.png$/), saveAs: true }));
  expect(host.textContent).toContain('Download avviato');
});
it('cancels an in-flight capture when the active tab changes', async () => {
  let finish!: (value: string) => void;
  api.tabs.captureVisibleTab.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const button = [...host.querySelectorAll('button')].find(item => item.textContent?.includes('Schermata'))!;
  await act(async () => button.click());
  await act(async () => api.tabs.onActivated.addListener.mock.calls[0]![0]({ windowId: 3 }));
  await act(async () => finish('data:image/png;base64,AA=='));
  expect(api.downloads.download).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Scheda cambiata');
});
it('offers responsive width presets and rejects values outside the supported range', async () => {
  const input = host.querySelector<HTMLInputElement>('#screenshot-page-width')!;
  const mobile = [...host.querySelectorAll('button')].find(item => item.textContent?.includes('Mobile 400'))!;
  await act(async () => mobile.click());
  expect(input.value).toBe('400');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '200');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const fullPage = [...host.querySelectorAll('button')].find(item => item.textContent?.includes('Pagina intera'))!;
  await act(async () => fullPage.click());
  expect(host.textContent).toContain('tra 320 e 2560 px');
});
it('offers PNG, JPEG and WebP plus the clipboard destination', () => {
  const format = host.querySelector<HTMLSelectElement>('#screenshot-format')!;
  const destination = host.querySelector<HTMLSelectElement>('#screenshot-destination')!;
  expect([...format.options].map(option => option.value)).toEqual(['image/png', 'image/jpeg', 'image/webp']);
  expect([...destination.options].map(option => option.value)).toEqual(['download', 'clipboard']);
});
