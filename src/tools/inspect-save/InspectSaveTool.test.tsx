import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InspectSaveTool } from './InspectSaveTool';

const api = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() });
  return {
    tabs: {
      query: vi.fn(),
      connect: vi.fn(),
      captureVisibleTab: vi.fn(),
      onActivated: event(),
      onUpdated: event(),
      onRemoved: event(),
    },
    windows: { getCurrent: vi.fn() },
    scripting: { executeScript: vi.fn() },
    downloads: { download: vi.fn() },
  };
});
vi.mock('wxt/browser', () => ({ browser: api }));

vi.mock('./capture', () => ({
  inspectFilename: (tag: string, ext = 'png') => `ispeziona-salva-${tag}-test.${ext}`,
  captureElementPng: vi.fn(async () => ({ png: 'data:image/png;base64,abc', clipped: false })),
}));

let root: Root;
let host: HTMLDivElement;
let message: ((value: Record<string, unknown>) => void) | undefined;
let portPostMessage: ReturnType<typeof vi.fn> | undefined;
let session = '';

const samplePayload = {
  tag: 'div',
  tagLabel: 'Div',
  selector: 'div.card',
  classes: '.card',
  dimensions: '320 × 230',
  rect: { left: 10, top: 20, width: 320, height: 230, viewportWidth: 1280, viewportHeight: 800, scrollX: 0, scrollY: 0 },
  clipped: false,
  sections: [{
    id: 'element',
    title: 'Elemento',
    rows: [{ label: 'Tag', value: '<div>' }],
  }],
  markup: '<style>.x{color:red;}</style><div class="x">Hi</div>',
};

function startButton() {
  return [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Seleziona') || button.textContent?.includes('Clicca una sezione'));
}

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  api.windows.getCurrent.mockResolvedValue({ id: 10 });
  api.tabs.query.mockResolvedValue([{ id: 1, windowId: 10, url: 'https://page.test/' }]);
  api.scripting.executeScript.mockResolvedValue([{ documentId: 'doc-1' }]);
  api.tabs.connect.mockImplementation((_id, options: { name: string }) => {
    session = options.name.split(':')[1]!;
    portPostMessage = vi.fn();
    return {
      disconnect: vi.fn(),
      postMessage: (value: Record<string, unknown>) => {
        portPostMessage?.(value);
        if (value.type === 'isolate-capture') {
          queueMicrotask(() => message?.({ type: 'isolated', session }));
        }
      },
      onMessage: { addListener(fn: (value: Record<string, unknown>) => void) { message = fn; } },
      onDisconnect: { addListener: vi.fn() },
    };
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<InspectSaveTool />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('starts picker from the header button', async () => {
  expect(host.querySelector('h2')?.textContent).toBe('Ispeziona e salva');
  expect(startButton()?.textContent).toContain('Seleziona');
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  expect(api.scripting.executeScript).toHaveBeenCalled();
  expect(host.textContent).toContain('Clicca una sezione');
});

it('shows snapshot after selection and resets the header button', async () => {
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'ready', session }));
  await act(async () => message?.({ type: 'snapshot', session, payload: samplePayload }));
  await act(async () => Promise.resolve());
  expect(portPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'isolate-capture', session }));
  expect(host.textContent).toContain('div.card');
  expect(host.textContent).toContain('Copia codice');
  expect(host.textContent).toContain('Scarica immagine');
  expect(host.textContent).toContain('Scarica codice');
  expect(startButton()?.textContent).toContain('Seleziona');
});

it('invalidates snapshot when the tab changes', async () => {
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'snapshot', session, payload: samplePayload }));
  await act(async () => Promise.resolve());
  expect(host.textContent).toContain('div.card');

  const late = session;
  await act(async () => api.tabs.onActivated.addListener.mock.calls[0]![0]({ windowId: 10 }));
  expect(host.textContent).not.toContain('div.card');

  await act(async () => message?.({ type: 'snapshot', session: late, payload: { ...samplePayload, selector: 'div.late' } }));
  expect(host.textContent).not.toContain('div.late');
});

it('copies markup from the stored snapshot', async () => {
  const writeText = vi.fn(async () => undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'snapshot', session, payload: samplePayload }));
  await act(async () => Promise.resolve());
  const copy = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Copia codice'));
  await act(async () => { copy!.click(); await Promise.resolve(); });
  expect(writeText).toHaveBeenCalledWith(samplePayload.markup);
});

it('downloads html markup from the stored snapshot', async () => {
  const createObjectURL = vi.fn(() => 'blob:test');
  const revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'snapshot', session, payload: samplePayload }));
  await act(async () => Promise.resolve());
  const download = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Scarica codice'));
  await act(async () => { download!.click(); await Promise.resolve(); });
  expect(createObjectURL).toHaveBeenCalled();
  expect(api.downloads.download).toHaveBeenCalledWith(expect.objectContaining({ filename: 'ispeziona-salva-div-test.html' }));
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
});

it('downloads the png preview', async () => {
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'snapshot', session, payload: samplePayload }));
  await act(async () => Promise.resolve());
  const download = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Scarica immagine'));
  await act(async () => { download!.click(); await Promise.resolve(); });
  expect(api.downloads.download).toHaveBeenCalledWith(expect.objectContaining({ filename: 'ispeziona-salva-div-test.png' }));
});

it('clears the previous snapshot and starts a new picker', async () => {
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'snapshot', session, payload: samplePayload }));
  await act(async () => Promise.resolve());
  expect(host.textContent).toContain('div.card');
  expect(api.scripting.executeScript).toHaveBeenCalledTimes(1);

  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  expect(host.textContent).not.toContain('div.card');
  expect(host.textContent).toContain('Clicca una sezione');
  expect(api.scripting.executeScript).toHaveBeenCalledTimes(2);
});

it('forwards arrow keys to the picker while active', async () => {
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'ready', session }));
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  expect(portPostMessage).toHaveBeenCalledWith({ type: 'command', session, command: 'navigate-up' });
});
