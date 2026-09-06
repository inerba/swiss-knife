import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ColorsTool } from './ColorsTool';
import { COLOR_HISTORY_KEY } from './history';

const api = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() });
  return {
    tabs: { query: vi.fn(), connect: vi.fn(), onActivated: event(), onUpdated: event(), onRemoved: event() },
    windows: { getCurrent: vi.fn() },
    scripting: { executeScript: vi.fn() },
    storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() }, onChanged: event() },
  };
});
vi.mock('wxt/browser', () => ({ browser: api }));

let root: Root;
let host: HTMLDivElement;
let store: Record<string, unknown>;

function sessionFromPortName(name: string) {
  return name.split(':').slice(2).join(':');
}

function mockPagePalettePort(colors: Array<{ value: string; uses: string[]; count: number }>, delayResult = false) {
  let listener: ((message: Record<string, unknown>) => void) | undefined;
  let session = '';
  api.tabs.connect.mockImplementation((_tabId, options: { name: string }) => {
    session = sessionFromPortName(options.name);
    return {
      onMessage: { addListener: vi.fn((fn: (message: Record<string, unknown>) => void) => {
        listener = fn;
        fn({ type: 'ready', session });
        fn({ type: 'analysing', session });
        if (!delayResult) fn({ type: 'result', session, result: { colors, warnings: [] } });
      }) },
      onDisconnect: { addListener: vi.fn() },
      disconnect: vi.fn(),
    };
  });
  return {
    complete: async () => {
      await act(async () => { if (listener) listener({ type: 'result', session, result: { colors, warnings: [] } }); });
    },
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  store = { [COLOR_HISTORY_KEY]: [
    { value: '#ff0000', updatedAt: 2 },
    { value: '#00ff00', updatedAt: 1 },
  ] };
  api.windows.getCurrent.mockResolvedValue({ id: 1 });
  api.tabs.query.mockResolvedValue([{ id: 1, windowId: 1, url: 'https://example.test/' }]);
  api.scripting.executeScript.mockResolvedValue([{ documentId: 'doc-1' }]);
  api.storage.local.get.mockImplementation(async (key?: string) => {
    if (typeof key === 'string') return { [key]: store[key] };
    return { ...store };
  });
  api.storage.local.set.mockImplementation(async (value: Record<string, unknown>) => { Object.assign(store, value); });
  api.storage.local.remove.mockImplementation(async (key: string) => { delete store[key]; });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<ColorsTool />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('removes a single saved color from history', async () => {
  expect(host.textContent).toContain('#ff0000');
  expect(host.textContent).toContain('#00ff00');
  const remove = host.querySelector<HTMLButtonElement>('[aria-label="Rimuovi #ff0000"]');
  expect(remove).toBeTruthy();
  await act(async () => remove!.click());
  expect(host.textContent).not.toContain('#ff0000');
  expect(host.textContent).toContain('#00ff00');
  expect(host.textContent).toContain('Colore rimosso');
  expect(store[COLOR_HISTORY_KEY]).toHaveLength(1);
});

it('removes the selected saved colors', async () => {
  const checkbox = host.querySelector<HTMLInputElement>('[aria-label="Seleziona #00ff00"]');
  await act(async () => checkbox!.click());
  const removeSelected = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Elimina selezionati'));
  expect(removeSelected).toBeTruthy();
  await act(async () => removeSelected!.click());
  expect(host.textContent).not.toContain('#00ff00');
  expect(host.textContent).toContain('#ff0000');
  expect(store[COLOR_HISTORY_KEY]).toHaveLength(1);
});

it('shows page palette colors after Genera Palette', async () => {
  mockPagePalettePort([
    { value: 'rgb(245, 158, 11)', uses: ['sfondo'], count: 1 },
    { value: 'rgb(255, 255, 255)', uses: ['testo'], count: 2 },
  ]);
  const button = [...host.querySelectorAll('button')].find(item => item.textContent?.includes('Genera Palette'));
  expect(button).toBeTruthy();
  await act(async () => button!.click());
  expect(host.textContent).toContain('2 colori trovati');
  expect(host.textContent).toContain('#f59e0b');
  expect(host.textContent).toContain('#ffffff');
  expect(api.scripting.executeScript).toHaveBeenCalled();
  expect(api.tabs.connect).toHaveBeenCalledWith(1, expect.objectContaining({ name: expect.stringMatching(/^swiss-color-picker:page:/) }));
});

it('ignores a delayed page palette after tab change', async () => {
  const port = mockPagePalettePort([
    { value: 'rgb(245, 158, 11)', uses: ['sfondo'], count: 1 },
  ], true);
  const button = [...host.querySelectorAll('button')].find(item => item.textContent?.includes('Genera Palette'));
  await act(async () => button!.click());
  await act(async () => api.tabs.onActivated.addListener.mock.calls[0]![0]({ windowId: 1 }));
  await port.complete();
  expect(host.textContent).not.toContain('#f59e0b');
  expect(host.textContent).toContain('Scheda cambiata');
});
