import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultPasswordGeneratorPreferences, type PasswordGeneratorPreferences } from './preferences';
import { PasswordGeneratorTool } from './PasswordGeneratorTool';

const prefs = vi.hoisted(() => ({
  save: vi.fn(async (_value: PasswordGeneratorPreferences) => undefined),
  load: vi.fn(async () => defaultPasswordGeneratorPreferences),
}));

vi.mock('./preferences', async importOriginal => ({
  ...await importOriginal<typeof import('./preferences')>(),
  loadPasswordGeneratorPreferences: prefs.load,
  savePasswordGeneratorPreferences: prefs.save,
}));

let host: HTMLDivElement;
let root: Root;
const writeText = vi.fn();

function valueField() { return host.querySelector<HTMLInputElement>('#pw-value')!; }
function copyButton() { return [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Copia'))!; }
async function toggle(id: string) {
  await act(async () => host.querySelector<HTMLInputElement>(`#${id}`)!.click());
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  prefs.load.mockResolvedValue(defaultPasswordGeneratorPreferences);
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<PasswordGeneratorTool />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

it('shows a generated password on open and copies the current value without regenerating', async () => {
  const current = valueField().value;
  expect(current).toHaveLength(16);
  expect(copyButton().disabled).toBe(false);
  await act(async () => copyButton().click());
  expect(writeText).toHaveBeenCalledWith(current);
  expect(valueField().value).toBe(current);
  expect(host.textContent).toContain('Copiata');
});

it('regenerates live and reports when no character group is selected', async () => {
  const before = valueField().value;
  await toggle('pw-numbers');
  expect(valueField().value).not.toBe(before);
  await toggle('pw-lowercase');
  await toggle('pw-uppercase');
  await toggle('pw-symbols');
  expect(valueField().value).toBe('');
  expect(copyButton().disabled).toBe(true);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Seleziona almeno un gruppo di caratteri.');
});

it('hides the password without changing it and still copies the stored value', async () => {
  const current = valueField().value;
  const hide = host.querySelector<HTMLButtonElement>('[aria-label="Nascondi password"]')!;
  await act(async () => hide.click());
  expect(valueField().type).toBe('password');
  expect(valueField().value).toBe(current);
  await act(async () => copyButton().click());
  expect(writeText).toHaveBeenCalledWith(current);
});

it('keeps the slider and number field in sync while regenerating', async () => {
  const range = host.querySelector<HTMLInputElement>('#pw-length')!;
  await act(async () => {
    range.value = '12';
    range.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.querySelector<HTMLInputElement>('#pw-length-input')!.value).toBe('12');
  expect(valueField().value).toHaveLength(12);
});

it('debounces preference writes and never stores the generated password', async () => {
  await toggle('pw-repeats');
  expect(prefs.save).not.toHaveBeenCalled();
  await act(async () => { vi.advanceTimersByTime(300); });
  expect(prefs.save).toHaveBeenCalledTimes(1);
  const stored = prefs.save.mock.calls[0]?.[0];
  expect(stored?.excludeRepeats).toBe(true);
  expect(stored).not.toHaveProperty('password');
  expect(JSON.stringify(stored)).not.toContain(valueField().value);
});

it('does not dump letter alphabets and live-updates from the symbols field', async () => {
  expect(host.textContent).not.toContain('abcdefghijklmnopqrstuvwxyz');
  const field = host.querySelector<HTMLInputElement>('#pw-symbols-set')!;
  expect(field.value).toBe('!@#$%^&*()-_=+[]{};:,.<>?');
  await act(async () => {
    field.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '!?');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await toggle('pw-numbers');
  await toggle('pw-lowercase');
  await toggle('pw-uppercase');
  await toggle('pw-letter');
  expect(valueField().value).toMatch(/^[!?]{16}$/);
});

it('opens settings and restores factory defaults including the symbol set', async () => {
  await toggle('pw-repeats');
  const open = host.querySelector<HTMLButtonElement>('[aria-label="Impostazioni generatore password"]')!;
  await act(async () => open.click());
  expect(host.querySelector('#pw-settings-title')?.textContent).toBe('Impostazioni generatore');
  const restore = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Ripristina valori predefiniti'))!;
  await act(async () => restore.click());
  expect(host.querySelector<HTMLInputElement>('#pw-repeats')!.checked).toBe(false);
  expect(host.querySelector<HTMLInputElement>('#pw-symbols-set')!.value).toBe('!@#$%^&*()-_=+[]{};:,.<>?');
  expect(host.querySelector<HTMLInputElement>('#pw-length-input')!.value).toBe('16');
});

it('groups Includi and Regole in a disclosure card like the QR style sections', () => {
  const card = host.querySelector('.pw-style-card')!;
  expect([...card.querySelectorAll('summary')].map(node => node.textContent)).toEqual(['Includi', 'Regole']);
  expect(card.querySelectorAll('details.pw-acc')).toHaveLength(2);
  expect((card.querySelector('details.pw-acc') as HTMLDetailsElement).open).toBe(true);
});

it('shows an inline error when symbols are on and the set is empty', async () => {
  const field = host.querySelector<HTMLInputElement>('#pw-symbols-set')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(valueField().value).toBe('');
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Inserisci almeno un simbolo.');
});

