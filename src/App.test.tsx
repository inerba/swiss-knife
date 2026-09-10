import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { App } from './App';

const api = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() });
  return { tabs: { query: vi.fn(), create: vi.fn(), onActivated: event(), onUpdated: event(), onRemoved: event() },
    windows: { getCurrent: vi.fn() }, scripting: { executeScript: vi.fn() }, runtime: { openOptionsPage: vi.fn(), getManifest: vi.fn(() => ({ version: '1.1.0' })) },
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
afterEach(async () => { await act(async () => root.unmount()); host.remove(); document.documentElement.style.removeProperty('color-scheme'); delete document.documentElement.dataset.theme; });
it('lists Contrasti in the catalog', () => {
  const names = [...host.querySelectorAll('.tool-card strong')].map(node => node.textContent);
  expect(names).toContain('Contrasti');
  expect(host.querySelector('.version')?.textContent).toBe('1.1.0');
});
it('lists Generatore password in the catalog', () => {
  const names = [...host.querySelectorAll('.tool-card strong')].map(node => node.textContent);
  expect(names).toContain('Generatore password');
  expect(host.querySelectorAll('#tool-password-generator')).toHaveLength(1);
});
it('keeps catalog controls hidden until the filter and sort button is activated', async () => {
  const catalogControls = host.querySelector<HTMLDivElement>('#catalog-controls')!;
  expect(catalogControls.hidden).toBe(true);
  const toggle = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Filtra e riordina'))!;
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(catalogControls.hidden).toBe(false);
  expect(host.querySelector('#catalog-order')).not.toBeNull();
  expect(host.querySelector('#search')).not.toBeNull();
  await act(async () => toggle.click());
  expect(catalogControls.hidden).toBe(true);
});
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
  const brand = host.querySelector('.brand-icon > svg.lucide-pocket-knife');
  expect(brand).not.toBeNull();
  expect(brand?.getAttribute('fill')).toBe('none');
  const card = host.querySelector<HTMLButtonElement>('.tool-card');
  expect(card).not.toBeNull();
  expect(card!.querySelector('.tool-icon > svg')).not.toBeNull();
  expect(card!.querySelector('.tool-copy > strong')?.textContent).toBe('Elenca iframe');
  expect(card!.querySelector('.tool-copy > .muted')?.textContent).toContain('Trova i contenuti incorporati');
  expect(card!.textContent).not.toContain('Avvia strumento');
});
it('opens the local codec once and discards its input when leaving the tool', async () => {
  expect(host.querySelectorAll('#tool-text-codec')).toHaveLength(1);
  const writes = api.storage.local.set.mock.calls.length;
  await click('Codifica e converti');
  const input = host.querySelector<HTMLTextAreaElement>('#codec-input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'local only');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const convert = host.querySelector<HTMLButtonElement>('#codec-panel-convert .codec-submit')!;
  await act(async () => convert.click());
  expect(host.querySelector<HTMLTextAreaElement>('#codec-result')!.value).toBe('bG9jYWwgb25seQ==');
  expect(api.scripting.executeScript).not.toHaveBeenCalled();
  expect(api.tabs.query).not.toHaveBeenCalled();
  expect(api.storage.local.set.mock.calls.length).toBe(writes);
  await click('Tutti gli strumenti'); await click('Codifica e converti');
  expect(host.querySelector<HTMLTextAreaElement>('#codec-input')!.value).toBe('');
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
