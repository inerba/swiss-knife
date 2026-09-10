import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QrCodeTool } from './QrCodeTool';
import { decodeQrDataUrl, renderQr } from './codec';

const api = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() });
  return {
    tabs: { query: vi.fn(), onActivated: event(), onUpdated: event() },
    windows: { getCurrent: vi.fn() },
    downloads: { download: vi.fn() },
    storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined) } },
  };
});
vi.mock('wxt/browser', () => ({ browser: api }));
vi.mock('./codec', () => ({
  renderQr: vi.fn(async () => ({ png: 'data:image/png;base64,AA==', svg: '<svg/>' })),
  decodeQrDataUrl: vi.fn(async () => { throw new Error('Nessun QR code leggibile nell’immagine.'); }),
}));

let host: HTMLDivElement; let root: Root;

async function typeUrl(value: string) {
  const input = host.querySelector<HTMLTextAreaElement>('#qr-create-panel textarea')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function flushVerify() {
  await act(async () => {
    vi.advanceTimersByTime(200);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(renderQr).mockResolvedValue({ png: 'data:image/png;base64,AA==', svg: '<svg/>' });
  vi.mocked(decodeQrDataUrl).mockRejectedValue(new Error('Nessun QR code leggibile nell’immagine.'));
  vi.useFakeTimers();
  api.windows.getCurrent.mockResolvedValue({ id: 3 });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root.render(<QrCodeTool />); await Promise.resolve(); });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function exportButtons() {
  return [...host.querySelectorAll('button')].filter(button => /Scarica PNG|Scarica SVG|Copia immagine/.test(button.textContent || ''));
}

it('shows presets, style groups and keeps exports disabled until a QR is generated', () => {
  expect(host.textContent).toContain('Preset');
  expect(host.textContent).toContain('Classico');
  expect(host.textContent).toContain('Moduli');
  expect(host.textContent).toContain('Angoli esterni');
  expect(host.textContent).toContain('Angoli interni');
  expect(host.textContent).toContain('Sfondo');
  expect(host.textContent).toContain('Logo');
  expect(host.textContent).toContain('Dimensione e correzione');
  expect(host.textContent).not.toContain('Impostazioni avanzate');
  expect(host.textContent).not.toContain('Verifica leggibilità');
  expect(host.textContent).not.toContain('Salva preset');
  expect(exportButtons().every(button => button.disabled)).toBe(true);
  expect(host.querySelector('.qr-preview')).toBeNull();
});

it('shows save preset only after a savable style change', async () => {
  expect(host.textContent).not.toContain('Salva preset');
  await typeUrl('https://example.it');
  expect(host.textContent).not.toContain('Salva preset');

  const margin = [...host.querySelectorAll('label')].find(label => (label.textContent || '').startsWith('Margine:'))?.querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(margin, '40');
    margin?.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.textContent).toContain('Salva preset');
  expect([...host.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Salva')).toBe(true);

  const preset = host.querySelector<HTMLSelectElement>('.qr-preset-bar select')!;
  const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  await act(async () => {
    selectSetter?.call(preset, 'classico');
    preset.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(host.textContent).not.toContain('Salva preset');
});

it('does not treat a session-only logo as a savable preset change', async () => {
  vi.stubGlobal('FileReader', class {
    result = 'data:image/png;base64,aa';
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    readAsDataURL() { queueMicrotask(() => this.onload?.()); }
    readAsText() { queueMicrotask(() => this.onload?.()); }
  });
  const input = host.querySelector<HTMLInputElement>('#qr-create-panel input[type="file"]')!;
  const file = new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' });
  await act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: { 0: file, length: 1, item: (index: number) => index === 0 ? file : null } });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(host.textContent).toContain('Logo aggiunto');
  expect(host.textContent).not.toContain('Salva preset');
  vi.unstubAllGlobals();
});

it('enables image exports as soon as the QR is generated', async () => {
  await typeUrl('https://example.it');
  await flushVerify();
  expect(renderQr).toHaveBeenCalled();
  expect(decodeQrDataUrl).not.toHaveBeenCalled();
  expect(exportButtons().every(button => !button.disabled)).toBe(true);
  const preview = host.querySelector('.image-preview.qr-preview');
  expect(preview).not.toBeNull();
  expect(preview?.querySelector('img')).not.toBeNull();
});

it('shows page, file and paste routes in the reading tab', async () => {
  const read = [...host.querySelectorAll('button')].find(button => button.textContent === 'Leggi')!;
  await act(async () => read.click());
  expect(host.textContent).toContain('Ispeziona QR nella pagina');
  expect(host.textContent).toContain('Carica PNG, JPEG o SVG');
  expect(host.textContent).toContain('Incolla qui un’immagine');
});
