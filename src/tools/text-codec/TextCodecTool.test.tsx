import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TextCodecTool } from './TextCodecTool';
import { generateHash } from './hash';

vi.mock('./hash', () => ({ generateHash: vi.fn(async () => 'a'.repeat(64)) }));
let host: HTMLDivElement; let root: Root;
const readText = vi.fn(); const writeText = vi.fn();
const button = (name: string) => [...host.querySelectorAll('button')].find(el => (name !== 'Converti' || el.getAttribute('role') !== 'tab') && (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name)!;
const input = () => host.querySelector<HTMLTextAreaElement>('#codec-input')!;
const output = () => host.querySelector<HTMLTextAreaElement>('#codec-result')!;
async function click(name: string) { await act(async () => button(name).click()); }
async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function select(id: string, value: string) {
  await act(async () => {
    const el = host.querySelector<HTMLSelectElement>(`#${id}`)!;
    el.value = value; el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
beforeEach(async () => {
  vi.useFakeTimers(); vi.clearAllMocks();
  readText.mockResolvedValue('dagli appunti'); writeText.mockResolvedValue(undefined);
  vi.mocked(generateHash).mockResolvedValue('a'.repeat(64));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText, writeText } });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<TextCodecTool />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

it('converts, copies and chains using the result format without executing again', async () => {
  expect(button('Copia').disabled).toBe(true);
  await type('ciao'); await click('Converti');
  expect(output().value).toBe('Y2lhbw==');
  await click('Copia'); expect(writeText).toHaveBeenCalledWith('Y2lhbw==');
  await click('Usa come input');
  expect(input().value).toBe('Y2lhbw=='); expect(document.activeElement).toBe(input());
  expect(host.querySelector<HTMLSelectElement>('#codec-from')!.value).toBe('base64');
  expect(button('Copia').disabled).toBe(true);
  await select('codec-to', 'hex'); await click('Converti');
  expect(output().value).toBe('6369616f');
});
it('swaps formats without changing input or converting', async () => {
  await type('Y2lhbw=='); await click('Inverti formati');
  expect(input().value).toBe('Y2lhbw=='); expect(button('Copia').disabled).toBe(true);
  await click('Converti'); expect(output().value).toBe('ciao');
});
it('preserves malformed input and exposes an inline error only after conversion', async () => {
  await select('codec-from', 'hex'); await type('gg');
  expect(input().getAttribute('aria-invalid')).not.toBe('true');
  await click('Converti');
  expect(input().value).toBe('gg'); expect(input().getAttribute('aria-invalid')).toBe('true');
  expect(host.querySelector('[role="alert"]')!.textContent).toContain('HEX');
  expect(button('Copia').disabled).toBe(true);
  await type('41'); expect(input().getAttribute('aria-invalid')).not.toBe('true');
});
it('supports empty results and empty input hashes', async () => {
  await click('Converti'); expect(output().value).toBe(''); expect(button('Copia').disabled).toBe(false);
  await click('Hash'); await click('Genera hash');
  expect(generateHash).toHaveBeenCalledWith('', 'SHA-256'); expect(output().value).toBe('a'.repeat(64));
  await click('Usa come input');
  expect(host.querySelector<HTMLSelectElement>('#codec-from')!.value).toBe('hex');
});
it('invalidates outputs on editing, changing parameters and clearing', async () => {
  await type('a'); await click('Converti'); await type('b'); expect(button('Copia').disabled).toBe(true);
  await click('Converti'); await select('codec-to', 'hex'); expect(output().value).toBe('');
  await click('Converti'); await click('Svuota'); expect(input().value).toBe(''); expect(output().value).toBe('');
  expect(host.querySelector<HTMLSelectElement>('#codec-to')!.value).toBe('hex');
});
it('does not overwrite a newer edit with a pending paste', async () => {
  let resolve!: (text: string) => void;
  readText.mockReturnValue(new Promise<string>(done => { resolve = done; }));
  await click('Incolla'); await type('nuovo');
  await act(async () => resolve('vecchio'));
  expect(input().value).toBe('nuovo');
});
it('provides manual clipboard fallback without deleting input or output', async () => {
  await type('ciao'); readText.mockRejectedValue(new Error('denied')); await click('Incolla');
  expect(input().value).toBe('ciao'); expect(document.activeElement).toBe(input());
  expect(host.textContent).toContain('Ctrl+V');
  await click('Converti'); writeText.mockRejectedValue(new Error('denied')); await click('Copia');
  expect(output().value).toBe('Y2lhbw=='); expect(host.textContent).toContain('manualmente');
});
it('ignores a hash result after editing and prevents duplicate submissions', async () => {
  let resolve!: (text: string) => void;
  vi.mocked(generateHash).mockReturnValue(new Promise<string>(done => { resolve = done; }));
  await click('Hash'); await click('Genera hash'); expect(button('Elaborazione…').disabled).toBe(true);
  await type('nuovo'); await act(async () => resolve('obsolete'));
  expect(output().value).toBe(''); expect(button('Copia').disabled).toBe(true);
});
it('only suggests after debounce, then prepares conversion without transforming', async () => {
  await type('Y2lhbw=='); expect(host.textContent).not.toContain('Sembra Base64');
  await act(async () => vi.advanceTimersByTime(300));
  expect(host.textContent).toContain('Sembra Base64');
  await click('Imposta conversione in testo');
  expect(input().value).toBe('Y2lhbw=='); expect(button('Copia').disabled).toBe(true);
  expect(host.querySelector<HTMLSelectElement>('#codec-from')!.value).toBe('base64');
});
it('supports keyboard tabs, counts Unicode points and hides suggestions in Hash', async () => {
  await type('é😀'); expect(host.textContent).toContain('2 caratteri');
  const tab = host.querySelector('[role="tab"]')!;
  await act(async () => tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
  expect(document.activeElement?.textContent).toBe('Hash');
  expect(host.querySelector('#codec-algorithm')).not.toBeNull();
  await type('Y2lhbw=='); await act(async () => vi.advanceTimersByTime(300));
  expect(host.textContent).not.toContain('Sembra Base64');
});
