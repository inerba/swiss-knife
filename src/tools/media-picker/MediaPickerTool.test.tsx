import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MediaPickerTool } from './MediaPickerTool';
const mocks = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() });
  return { start: vi.fn(), read: vi.fn(), close: vi.fn(), api: {
    tabs: { query: vi.fn(), create: vi.fn(), onActivated: event(), onUpdated: event(), onRemoved: event() },
    windows: { getCurrent: vi.fn() }, permissions: { request: vi.fn() },
    downloads: { download: vi.fn(), search: vi.fn(), onChanged: event() },
  } };
});
vi.mock('wxt/browser', () => ({ browser: mocks.api }));
vi.mock('./session', () => ({ startSession: mocks.start }));
vi.mock('./metadata', async importOriginal => ({ ...await importOriginal<typeof import('./metadata')>(), readDetails: mocks.read }));
let host: HTMLDivElement; let root: Root;
const selected = { images: [{ id: '1', url: 'https://cdn.test/a.png', sources: ['Immagine'], width: 10, height: 10 }], warnings: [], pageUrl: 'https://page.test/' };
const details = { filename: 'a.png', extension: 'PNG', mime: null, width: 10, height: 10, size: null, verified: false, permission: 'https://cdn.test/*', error: 'Accesso necessario' };
async function click(text: string) { await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent?.includes(text))!.click()); }
async function clickEnabled(text: string) {
  await act(async () => {
    for (let i = 0; i < 25; i++) {
      const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes(text)) as HTMLButtonElement | undefined;
      if (button && !button.disabled) { button.click(); return; }
      await Promise.resolve();
    }
    throw new Error(`Enabled button “${text}” not found`);
  });
}
async function select(index = 0) { await act(async () => mocks.start.mock.calls[index]![2](selected)); }
beforeEach(async () => {
  vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.api.tabs.query.mockResolvedValue([{ id: 1, url: 'https://page.test/' }]);
  mocks.api.windows.getCurrent.mockResolvedValue({ id: 10 });
  mocks.start.mockResolvedValue({ close: mocks.close, readBlob: vi.fn() }); mocks.read.mockResolvedValue(details);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<MediaPickerTool />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('starts automatically and keeps usable results when authorization is denied', async () => {
  expect(mocks.start).toHaveBeenCalledWith(1, expect.any(AbortSignal), expect.any(Function), expect.any(Function));
  await select(); mocks.api.permissions.request.mockResolvedValue(false);
  await click('Autorizza e completa');
  expect(mocks.api.permissions.request).toHaveBeenCalledWith({ origins: ['https://cdn.test/*'] });
  expect(host.textContent).toContain('Autorizzazione negata'); expect(host.textContent).toContain('10 × 10 px');
});
it('ignores selection and metadata responses after navigation', async () => {
  let resolve!: (value: unknown) => void;
  mocks.read.mockImplementation(() => new Promise(done => { resolve = done; }));
  await select();
  await act(async () => mocks.api.tabs.onUpdated.addListener.mock.calls[0]![0](1, { status: 'loading' }));
  await act(async () => resolve(details)); await select();
  expect(host.textContent).not.toContain('a.png'); expect(mocks.close).toHaveBeenCalled();
});
it('replaces a selection and cleans listeners and the page connection on exit', async () => {
  await select(); await click('Nuova selezione');
  expect(host.textContent).not.toContain('a.png'); expect(mocks.close).toHaveBeenCalled();
  await select(1); expect(host.textContent).toContain('a.png');
});
it('reports download failure beside the image and allows retry', async () => {
  await select(); mocks.api.downloads.download.mockRejectedValue(new Error('NETWORK_FAILED'));
  await click('Scarica'); expect(host.textContent).toContain('NETWORK_FAILED');
  expect(host.querySelector<HTMLButtonElement>('button')?.disabled).toBe(false);
});
it('hides embedded SVG source and copies it as text', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const blob = Object.assign(new Blob([], { type: 'image/svg+xml' }), { text: vi.fn().mockResolvedValue('<svg><path /></svg>') });
  mocks.read.mockResolvedValue({ ...details, mime: 'image/svg+xml', kind: 'image', blob });
  await act(async () => {
    mocks.start.mock.calls[0]![2]({ ...selected, images: [{ ...selected.images[0], url: 'data:image/svg+xml,%3Csvg%3E' }] });
    await Promise.resolve();
  });
  expect(host.textContent).not.toContain('data:image/svg+xml,%3Csvg%3E');
  expect(host.textContent).toContain('il codice non viene visualizzato');
  await click('Copia');
  expect(writeText).toHaveBeenCalledWith('<svg><path /></svg>');
  expect(host.textContent).toContain('Codice SVG copiato negli appunti');
});
it('renders HTTP file URLs as copyable links', async () => {
  await select();
  const link = host.querySelector<HTMLAnchorElement>('.media-url a');
  expect(link?.href).toBe('https://cdn.test/a.png');
  expect(link?.target).toBe('_blank');
});
const many = {
  ...selected,
  images: [
    selected.images[0],
    { id: '2', url: 'https://cdn.test/b.jpg', sources: ['Poster'], width: 8, height: 8 },
  ],
};
async function selectMany() {
  mocks.read.mockImplementation(async image => ({
    ...details, filename: String(image.url).split('/').pop(), permission: undefined, error: undefined,
  }));
  await act(async () => mocks.start.mock.calls[0]![2](many));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}
it('hides the bulk download until more than one file is listed', async () => {
  await select();
  expect([...host.querySelectorAll('button')].some(button => button.textContent?.includes('Scarica tutti'))).toBe(false);
});
it('downloads every listed file without a save dialog and reports a partial batch', async () => {
  mocks.api.downloads.download.mockResolvedValueOnce(10).mockRejectedValueOnce(new Error('NETWORK_FAILED'));
  await selectMany();
  await clickEnabled('Scarica tutti');
  expect(mocks.api.downloads.download).toHaveBeenCalledTimes(2);
  expect(mocks.api.downloads.download.mock.calls[0]![0]).toMatchObject({
    url: 'https://cdn.test/a.png', filename: 'cattura-media/page.test/a.png', saveAs: false,
  });
  expect(host.textContent).toContain('1 download avviato');
  expect(host.textContent).toContain('1 non riuscito');
  expect(host.textContent).toContain('NETWORK_FAILED');
});
it('skips page blobs that were never recovered and ignores a finished batch after navigation', async () => {
  let finish!: (id: number) => void;
  mocks.api.downloads.download.mockImplementation(() => new Promise(done => { finish = done; }));
  mocks.read.mockResolvedValue({ ...details, permission: undefined, error: undefined });
  await act(async () => mocks.start.mock.calls[0]![2]({
    ...selected,
    images: [selected.images[0], { id: '2', url: 'blob:https://page.test/2', sources: ['Video'], width: null, height: null }],
  }));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  await clickEnabled('Scarica tutti');
  expect(host.textContent).toContain('non incluso nel download di gruppo');
  await act(async () => mocks.api.tabs.onUpdated.addListener.mock.calls[0]![0](1, { status: 'loading' }));
  await act(async () => finish(10));
  expect(host.textContent).toContain('Scheda cambiata');
  expect(host.textContent).not.toContain('download avviati');
});
