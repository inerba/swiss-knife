import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { captureElementPng } from '../inspect-save/capture';
import { BrowserContextTool } from './BrowserContextTool';
import { downloadReport } from './download';
import { samplePayload } from './test-fixtures';

const api = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() });
  return {
    tabs: { query: vi.fn(), connect: vi.fn(), onActivated: event(), onUpdated: event(), onRemoved: event() },
    windows: { getCurrent: vi.fn() },
    scripting: { executeScript: vi.fn() },
  };
});
vi.mock('wxt/browser', () => ({ browser: api }));
vi.mock('../inspect-save/capture', () => ({ captureElementPng: vi.fn() }));
vi.mock('./download', () => ({ downloadReport: vi.fn() }));

let root: Root;
let host: HTMLDivElement;
let message: ((value: Record<string, unknown>) => void) | undefined;
let portPostMessage: ReturnType<typeof vi.fn>;
let session = '';
const writeText = vi.fn();

function button(label: string) {
  return [...host.querySelectorAll('button')].find(item => item.textContent?.includes(label));
}

function requestField() {
  return host.querySelector<HTMLTextAreaElement>('#context-change-request');
}

function preview(summary: string) {
  return [...host.querySelectorAll('.context-report')].find(item => item.querySelector('summary')?.textContent === summary)?.querySelector('pre');
}

async function typeRequest(value: string) {
  const field = requestField()!;
  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!;
    descriptor.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

async function capture(payload = samplePayload()) {
  await act(async () => { button('Seleziona')!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'ready', session }));
  await act(async () => message?.({ type: 'snapshot', session, payload }));
  await flush();
}

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(navigator, { clipboard: { writeText } });
  writeText.mockResolvedValue(undefined);
  vi.mocked(captureElementPng).mockResolvedValue({ png: 'data:image/png;base64,abc', clipped: false });
  vi.mocked(downloadReport).mockResolvedValue('complete');
  api.windows.getCurrent.mockResolvedValue({ id: 10 });
  api.tabs.query.mockResolvedValue([{ id: 1, windowId: 10, url: 'https://page.test/' }]);
  api.scripting.executeScript.mockResolvedValue([{ documentId: 'doc-1' }]);
  api.tabs.connect.mockImplementation((_id: number, options: { name: string }) => {
    session = options.name.split(':')[1]!;
    portPostMessage = vi.fn();
    return {
      disconnect: vi.fn(),
      postMessage: (value: Record<string, unknown>) => {
        portPostMessage(value);
        if (value.type === 'isolate-capture') queueMicrotask(() => message?.({ type: 'isolated', session }));
      },
      onMessage: { addListener(fn: (value: Record<string, unknown>) => void) { message = fn; } },
      onDisconnect: { addListener: vi.fn() },
    };
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<BrowserContextTool />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('injects its own picker script', async () => {
  expect(host.querySelector('h2')?.textContent).toBe('Browser context');
  await act(async () => { button('Seleziona')!.click(); await Promise.resolve(); });
  expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 1 }, files: ['/browser-context.js'] });
  expect(api.tabs.connect).toHaveBeenCalledWith(1, expect.objectContaining({ name: expect.stringMatching(/^swiss-browser-context:/) }));
  expect(host.textContent).toContain('Clicca un elemento');
});

it('shows the result without copying and offers an agent prompt', async () => {
  await capture();
  expect(writeText).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('copiato negli appunti');
  expect(host.textContent).toContain('Cosa vuoi cambiare?');
  expect(requestField()?.placeholder).toBe('Metti l’immagine a sinistra');
  expect(host.textContent).toContain('320 × 412');
  expect(host.textContent).toMatch(/Prompt: \d+ KB · ~\d+ token/);
  expect(button('Copia per agente')).toBeTruthy();
  expect(button('Copia report completo')).toBeTruthy();
  expect(button('Copia immagine')?.disabled).toBe(false);
  expect(preview('Anteprima prompt')?.textContent).toContain('The following context identifies');
  expect(preview('Anteprima prompt')?.textContent).not.toContain('## Requested change');
  expect(preview('Anteprima report')?.textContent).toContain('# div.card');
  expect(preview('Anteprima report')?.textContent).not.toContain('![Screenshot');
  expect(host.querySelector('.context-preview-box img')?.getAttribute('src')).toBe('data:image/png;base64,abc');
});

it('copies the agent prompt including the typed request', async () => {
  await capture();
  await typeRequest('Metti l’immagine a sinistra');
  expect(preview('Anteprima prompt')?.textContent).toContain('## Requested change\n\nMetti l’immagine a sinistra');
  await act(async () => { button('Copia per agente')!.click(); await Promise.resolve(); });
  await flush();
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText.mock.calls[0]![0]).toContain('## Requested change\n\nMetti l’immagine a sinistra');
  expect(writeText.mock.calls[0]![0]).not.toContain('## Styles');
  expect(host.textContent).toContain('Prompt copiato negli appunti.');
});

it('copies the full report and falls back when the clipboard is refused', async () => {
  await capture();
  await act(async () => { button('Copia report completo')!.click(); await Promise.resolve(); });
  await flush();
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText.mock.calls[0]![0]).toContain('# div.card');
  expect(writeText.mock.calls[0]![0]).toContain('## Styles');
  expect(host.textContent).toContain('Report copiato negli appunti.');

  writeText.mockRejectedValue(new Error('Document is not focused'));
  await act(async () => { button('Copia per agente')!.click(); await Promise.resolve(); });
  await flush();
  expect(host.querySelector<HTMLTextAreaElement>('.context-copy-fallback')?.value).toContain('The following context identifies');
  expect(host.textContent).toContain('Impossibile scrivere negli appunti. Seleziona e copia il testo qui sotto.');
});

it('keeps the report when the screenshot fails', async () => {
  vi.mocked(captureElementPng).mockRejectedValueOnce(new Error('capture failed'));
  await capture();
  expect(host.textContent).toContain('Anteprima non disponibile: il report non include lo screenshot.');
  expect(button('Copia immagine')?.disabled).toBe(true);
  expect(writeText).not.toHaveBeenCalled();
});

it('reports that the image cannot be copied', async () => {
  await capture();
  await act(async () => { button('Copia immagine')!.click(); await Promise.resolve(); });
  await flush();
  expect(host.textContent).toContain('Impossibile copiare l’immagine. Usa Scarica report.');
});

it('downloads the report', async () => {
  await capture();
  await act(async () => { button('Scarica report')!.click(); await Promise.resolve(); });
  await flush();
  expect(downloadReport).toHaveBeenCalledWith(expect.objectContaining({ element: 'div.card', png: 'data:image/png;base64,abc' }));
  expect(host.textContent).toContain('Report salvato in Download/swiss-knife/browser-context.');
});

it('explains a download without the screenshot', async () => {
  vi.mocked(downloadReport).mockResolvedValueOnce('screenshot-failed');
  await capture();
  await act(async () => { button('Scarica report')!.click(); await Promise.resolve(); });
  await flush();
  expect(host.textContent).toContain('Screenshot non salvato; report scaricato senza immagine.');
});

it('invalidates the result when the tab changes and ignores late messages', async () => {
  await capture();
  await typeRequest('Metti l’immagine a sinistra');
  expect(host.textContent).toContain('div.card');
  const late = session;
  await act(async () => api.tabs.onActivated.addListener.mock.calls[0]![0]({ windowId: 10 }));
  expect(host.textContent).not.toContain('div.card');
  expect(requestField()).toBeNull();
  expect(host.textContent).toContain('Scheda cambiata. Avvia lo strumento per lavorare su questa pagina.');
  await act(async () => message?.({ type: 'snapshot', session: late, payload: samplePayload({ element: 'div.late' }) }));
  await flush();
  expect(host.textContent).not.toContain('div.late');
});

it('sends confirm from the lock bar and shows the collecting status', async () => {
  await act(async () => { button('Seleziona')!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'ready', session }));
  await act(async () => message?.({ type: 'locked', session, preview: { tag: 'div', tagLabel: 'Div', selector: 'div.card', dimensions: '320 × 412' } }));
  await act(async () => { button('Conferma')!.click(); await Promise.resolve(); });
  expect(portPostMessage).toHaveBeenCalledWith({ type: 'command', session, command: 'confirm' });
  expect(host.textContent).toContain('Raccolta del contesto…');
});

it('cancels with Escape while picking', async () => {
  await act(async () => { button('Seleziona')!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'ready', session }));
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  expect(host.textContent).toContain('Selezione annullata.');
  expect(button('Seleziona')).toBeTruthy();
});

it('lists every selector with its match count and a copy button', async () => {
  await capture();
  const rows = [...host.querySelectorAll('.context-selector')];
  expect(rows.map(row => row.querySelector('.context-selector-label')?.textContent)).toEqual([
    'CSS breve', 'CSS completo', 'XPath relativo', 'Playwright',
  ]);
  expect(rows.map(row => row.querySelector('.context-selector-badge')?.textContent)).toEqual([
    'unico', 'unico', 'unico', '2 risultati (stima)',
  ]);
  expect(rows[2]!.querySelector('code')?.textContent).toBe("//main[@id='app']/div");

  writeText.mockClear();
  const copy = rows[2]!.querySelector<HTMLButtonElement>('button')!;
  expect(copy.getAttribute('aria-label')).toBe('Copia XPath relativo');
  await act(async () => { copy.click(); await Promise.resolve(); });
  await flush();
  expect(writeText).toHaveBeenCalledWith("//main[@id='app']/div");
  expect(copy.textContent).toContain('Copiato');
});

it('reports when a selector cannot be copied', async () => {
  await capture();
  writeText.mockRejectedValue(new Error('denied'));
  const copy = host.querySelector<HTMLButtonElement>('.context-selector button')!;
  await act(async () => { copy.click(); await Promise.resolve(); });
  await flush();
  expect(host.textContent).toContain('Impossibile copiare il selettore. Selezionalo e copialo a mano.');
});
