import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContrastTool } from './ContrastTool';

const api = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() });
  return {
    tabs: { query: vi.fn(), connect: vi.fn(), onActivated: event(), onUpdated: event(), onRemoved: event() },
    windows: { getCurrent: vi.fn() },
    scripting: { executeScript: vi.fn() },
  };
});
vi.mock('wxt/browser', () => ({ browser: api }));

let root: Root;
let host: HTMLDivElement;
let message: ((value: Record<string, unknown>) => void) | undefined;
let session = '';

function typeHex(label: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input).toBeTruthy();
  return act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    input!.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  api.windows.getCurrent.mockResolvedValue({ id: 10 });
  api.tabs.query.mockResolvedValue([{ id: 1, windowId: 10, url: 'https://page.test/' }]);
  api.scripting.executeScript.mockResolvedValue([{ documentId: 'doc-1' }]);
  api.tabs.connect.mockImplementation((_id, options: { name: string }) => {
    session = options.name.split(':')[1]!;
    return {
      disconnect: vi.fn(),
      onMessage: { addListener(fn: (value: Record<string, unknown>) => void) { message = fn; } },
      onDisconnect: { addListener: vi.fn() },
    };
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<ContrastTool />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('paints the sample on a decorative swatch, not on the field chrome', () => {
  const swatches = [...host.querySelectorAll<HTMLElement>('.contrast-field-swatch')];
  expect(swatches).toHaveLength(2);
  expect(swatches[0]!.style.backgroundColor.toLowerCase()).toMatch(/#000000|rgb\(0,\s*0,\s*0\)/i);
  expect(swatches[1]!.style.backgroundColor.toLowerCase()).toMatch(/#ffffff|rgb\(255,\s*255,\s*255\)/i);
  const textInner = host.querySelector('#contrast-text')!.parentElement as HTMLElement;
  const copy = host.querySelector<HTMLButtonElement>('[aria-label="Copia il colore del testo"]');
  expect(textInner.style.backgroundColor).toBe('');
  expect(textInner.style.color).toBe('');
  expect(copy!.style.color).toBe('');
  expect(copy!.parentElement?.className).toBe('contrast-field-actions');
});

it('shows 21:1 Ottimo for the default black-on-white pair', () => {
  expect(host.textContent).toContain('21.0 : 1');
  expect(host.textContent).toContain('Ottimo');
  expect(host.textContent).toContain('AA 4.5:1');
  expect(host.textContent).toContain('AAA 7:1');
  expect(host.textContent).not.toContain('Public Sans');
});

it('hides WCAG badges while a HEX field is invalid', async () => {
  await typeHex('Colore del testo', '#00');
  expect(host.textContent).not.toContain('21.0 : 1');
  expect(host.textContent).toMatch(/valido|HEX/i);
  expect(host.querySelector('[aria-invalid="true"]')).not.toBeNull();
});

it('swaps the two colors', async () => {
  await typeHex('Colore del testo', '#FFFFFF');
  await typeHex('Colore di sfondo', '#000000');
  const swap = host.querySelector<HTMLButtonElement>('[aria-label="Scambia i colori"]');
  await act(async () => swap!.click());
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Colore del testo"]')!.value.toLowerCase()).toBe('#000000');
});

it('assigns an eyedropper sample to the chosen field', async () => {
  Object.defineProperty(window, 'EyeDropper', {
    configurable: true,
    value: class { open() { return Promise.resolve({ sRGBHex: '#7241FF' }); } },
  });
  await act(async () => root.render(<ContrastTool />));
  const pick = host.querySelector<HTMLButtonElement>('[aria-label="Contagocce del testo"]');
  await act(async () => { pick!.click(); await Promise.resolve(); });
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Colore del testo"]')!.value.toLowerCase()).toBe('#7241ff');
});

it('applies a page sample and ignores it after the tab changes', async () => {
  const start = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Da elemento'));
  await act(async () => { start!.click(); await Promise.resolve(); });
  await act(async () => message?.({
    type: 'result',
    session,
    result: {
      foreground: '#FFFFFF',
      background: '#7241FF',
      fontFamily: 'Public Sans',
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: '400',
      warnings: [],
    },
  }));
  expect(host.textContent).toContain('Public Sans');
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Colore di sfondo"]')!.value.toLowerCase()).toBe('#7241ff');

  const late = session;
  await act(async () => api.tabs.onActivated.addListener.mock.calls[0]![0]({ windowId: 10 }));
  expect(host.textContent).not.toContain('Public Sans');
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Colore di sfondo"]')!.value.toLowerCase()).toBe('#7241ff');

  await act(async () => message?.({
    type: 'result',
    session: late,
    result: {
      foreground: '#111111',
      background: '#EEEEEE',
      fontFamily: 'Comic Sans MS',
      fontSize: '12px',
      lineHeight: '16px',
      fontWeight: '400',
      warnings: [],
    },
  }));
  expect(host.textContent).not.toContain('Comic Sans MS');
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Colore del testo"]')!.value.toLowerCase()).not.toBe('#111111');
});
