import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EmojiTool } from './EmojiTool';

const emojiData = vi.hoisted(() => [
  { emoji: '🎉', hexcode: '1F389', group: 'activities', name: 'party popper', italianName: 'trombetta per feste', keywords: ['party'], italianKeywords: ['festa'] },
  { emoji: '👋', hexcode: '1F44B', group: 'people-body', name: 'waving hand', italianName: 'mano che saluta', keywords: ['hello'], italianKeywords: ['ciao'], skins: ['👋', '👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿'] },
]);

vi.mock('./data', async importOriginal => ({
  ...await importOriginal<typeof import('./data')>(),
  loadEmojiData: vi.fn(async () => emojiData),
}));

const emojiPreferences = vi.hoisted(() => ({ save: vi.fn(async () => undefined) }));
vi.mock('./preferences', async importOriginal => ({
  ...await importOriginal<typeof import('./preferences')>(),
  loadEmojiPreferences: vi.fn(async () => ({ previewSize: 22 })),
  saveEmojiPreferences: emojiPreferences.save,
}));

let root: Root;
let host: HTMLDivElement;

async function changeSearch(value: string) {
  const input = host.querySelector<HTMLInputElement>('#emoji-search')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => undefined) } });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root.render(<EmojiTool />); await Promise.resolve(); });
});

afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('filters with bilingual search and selected category', async () => {
  await changeSearch('ciao');
  expect(host.querySelector('[aria-label="mano che saluta"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="trombetta per feste"]')).toBeNull();

  const activities = host.querySelector<HTMLButtonElement>('[aria-label="Attività"]')!;
  await act(async () => activities.click());
  expect(host.textContent).toContain('Nessuna emoji corrisponde');
});

it('copies the selected skin variant and reports clipboard errors', async () => {
  vi.useFakeTimers();
  const olive = host.querySelector<HTMLButtonElement>('[aria-label="Carnagione olivastra"]')!;
  await act(async () => olive.click());
  const hand = host.querySelector<HTMLButtonElement>('[aria-label="mano che saluta"]')!;
  await act(async () => hand.click());
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('👋🏽');
  expect(host.querySelector('[role="status"]')?.textContent).toContain('Emoji copiata');

  await act(async () => { vi.advanceTimersByTime(2_000); });
  expect(host.textContent).not.toContain('Emoji copiata');

  vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
  await act(async () => hand.click());
  expect(host.textContent).toContain('Impossibile copiare');
  vi.useRealTimers();
});

it('uses the selected icon-only category filters with accessible names and tooltips', () => {
  const expected = [
    ['Tutte', 'lucide-shapes'], ['Faccine ed emozioni', 'lucide-face-grinning'], ['Persone e corpo', 'lucide-users-round'],
    ['Animali e natura', 'lucide-paw-print'], ['Cibo e bevande', 'lucide-utensils'], ['Viaggi e luoghi', 'lucide-plane'],
    ['Attività', 'lucide-trophy'], ['Oggetti', 'lucide-lamp-desk'], ['Simboli', 'lucide-hash'], ['Bandiere', 'lucide-flag'],
  ];
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('.emoji-categories button')];
  expect(buttons).toHaveLength(10);
  expected.forEach(([name, icon]) => {
    const button = buttons.find(item => item.getAttribute('aria-label') === name);
    expect(button?.getAttribute('title')).toBe(name);
    expect(button?.textContent).toBe('');
    expect(button?.querySelector('svg')?.getAttribute('class')).toContain(icon);
  });
});

it('offers five local preview sizes and exposes emoji as native text draggables', async () => {
  const hand = host.querySelector<HTMLButtonElement>('[aria-label="mano che saluta"]')!;
  expect(hand.draggable).toBe(true);

  const setData = vi.fn();
  const transfer = { effectAllowed: '', setData };
  const drag = new Event('dragstart', { bubbles: true });
  Object.defineProperty(drag, 'dataTransfer', { value: transfer });
  await act(async () => hand.dispatchEvent(drag));
  expect(transfer.effectAllowed).toBe('copy');
  expect(setData).toHaveBeenCalledWith('text/plain', '👋');

  const settings = host.querySelector<HTMLButtonElement>('[aria-label="Impostazioni emoji"]')!;
  await act(async () => settings.click());
  const choices = [...host.querySelectorAll<HTMLButtonElement>('.emoji-size-options button')];
  expect(choices).toHaveLength(5);
  const largest = choices.find(button => button.getAttribute('aria-label') === 'Anteprima da 60 px')!;
  await act(async () => largest.click());
  expect(largest.getAttribute('aria-pressed')).toBe('true');
  expect(host.querySelector('.emoji-tool')?.className).toContain('emoji-preview-60');
});
