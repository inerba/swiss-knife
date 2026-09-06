import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { App } from './App';

const api = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() });
  return { tabs: { query: vi.fn(), create: vi.fn(), onActivated: event(), onUpdated: event(), onRemoved: event() },
    windows: { getCurrent: vi.fn() }, scripting: { executeScript: vi.fn() }, runtime: { openOptionsPage: vi.fn() },
    permissions: { contains: vi.fn(), request: vi.fn(), remove: vi.fn(), onAdded: event(), onRemoved: event() },
    storage: { local: { get: vi.fn(), set: vi.fn() }, onChanged: event() } };
});
vi.mock('wxt/browser', () => ({ browser: api }));
let root: Root;
let host: HTMLDivElement;
const result = { frames: [{ id: 1, title: 'Video', depth: 0, url: 'https://video.test/', reason: null, inaccessible: false }], pageUrl: 'https://page.test/', inaccessibleCount: 0 };
async function click(text: string) {
  const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes(text));
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  api.tabs.query.mockResolvedValue([{ id: 1, url: 'https://page.test/' }]);
  api.tabs.create.mockResolvedValue({});
  api.windows.getCurrent.mockResolvedValue({ id: 10 });
  api.scripting.executeScript.mockResolvedValue([{ result }]);
  api.permissions.contains.mockResolvedValue(false);
  api.storage.local.get.mockResolvedValue({});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<App />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('opens a tool, scans and opens the source in an active tab', async () => {
  await click('Elenca iframe');
  expect(host.textContent).toContain('1 iframe trovati');
  await click('Apri');
  expect(api.tabs.create).toHaveBeenCalledWith({ url: 'https://video.test/', active: true });
  await click('Tutti gli strumenti');
  expect(document.activeElement?.id).toBe('tool-iframes');
  expect(api.tabs.onActivated.removeListener).toHaveBeenCalled();
});
it('renders compact tool cards with Lucide icons and no redundant action label', () => {
  expect(host.querySelector('.brand-icon > svg.lucide-pocket-knife')).not.toBeNull();
  const card = host.querySelector<HTMLButtonElement>('.tool-card');
  expect(card).not.toBeNull();
  expect(card!.querySelector('.tool-icon > svg')).not.toBeNull();
  expect(card!.querySelector('.tool-copy > strong')?.textContent).toBe('Elenca iframe');
  expect(card!.querySelector('.tool-copy > .muted')?.textContent).toContain('Trova i contenuti incorporati');
  expect(card!.textContent).not.toContain('Avvia strumento');
});
it('invalidates results on activation and ignores other windows', async () => {
  await click('Elenca iframe');
  const changed = api.tabs.onActivated.addListener.mock.calls[0]![0];
  await act(async () => changed({ windowId: 20 }));
  expect(host.textContent).toContain('1 iframe trovati');
  await act(async () => changed({ windowId: 10 }));
  expect(host.textContent).not.toContain('https://video.test/');
  expect(host.textContent).toContain('Scheda cambiata');
});
it('discards pending scan after navigation', async () => {
  let complete!: (value: unknown) => void;
  api.scripting.executeScript.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  await click('Elenca iframe');
  await act(async () => api.tabs.onUpdated.addListener.mock.calls[0]![0](1, { status: 'loading' }));
  await act(async () => complete([{ result }]));
  expect(host.textContent).not.toContain('https://video.test/');
  expect(host.textContent).toContain('Scheda cambiata');
});
it('explains missing permission and protected pages', async () => {
  api.scripting.executeScript.mockRejectedValue(new Error('Missing host permission'));
  await click('Elenca iframe');
  expect(host.textContent).toContain('Clicca l’icona Swiss Knife');
  api.tabs.query.mockResolvedValue([{ id: 1, url: 'chrome://extensions/' }]);
  await click('Aggiorna');
  expect(host.textContent).toContain('Questa pagina è protetta');
});
