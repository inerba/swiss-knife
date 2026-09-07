import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { SettingsApp } from './SettingsApp';
const api = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('./components/GlobalSiteAccessSettings', () => ({ GlobalSiteAccessSettings: () => null }));
vi.mock('./tools/registry', () => ({ tools: ['a', 'b', 'c'].map(id => ({ id, name: id, description: id, icon: () => null })) }));
vi.mock('./lib/preferences', () => ({ loadToolPreferences: async () => ({ preferences: { orderedIds: ['a', 'b', 'c'], disabledIds: [] } }), saveToolPreferences: api.save }));
let root: Root, host: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<SettingsApp />));
  host.querySelectorAll('li').forEach((row, index) => {
    row.getBoundingClientRect = () => ({ top: index * 100, height: 80 }) as DOMRect;
  });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function drag(target: Element, type: string, y = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { clientY: { value: y }, dataTransfer: { value: { setData: vi.fn(), effectAllowed: '', dropEffect: '' } } });
  await act(async () => { target.dispatchEvent(event); });
}
it('shows a boundary before a card and inserts downward at that exact boundary', async () => {
  const rows = host.querySelectorAll('li');
  await drag(rows[0]!, 'dragstart'); await drag(rows[2]!, 'dragover', 210);
  expect(rows[2]!.classList.contains('drop-before')).toBe(true);
  expect(api.save).not.toHaveBeenCalled();
  await drag(rows[2]!, 'drop');
  expect(api.save).toHaveBeenCalledWith({ orderedIds: ['b', 'a', 'c'], disabledIds: [] });
  expect(host.querySelector('.drop-before')).toBeNull();
});
it('supports dropping after the last item', async () => {
  const rows = host.querySelectorAll('li');
  await drag(rows[0]!, 'dragstart'); await drag(rows[2]!, 'dragover', 280);
  expect(rows[2]!.classList.contains('drop-after')).toBe(true);
  await drag(rows[2]!, 'drop');
  expect(api.save).toHaveBeenCalledWith({ orderedIds: ['b', 'c', 'a'], disabledIds: [] });
});
it('supports upward insertion before the first item', async () => {
  const rows = host.querySelectorAll('li');
  await drag(rows[2]!, 'dragstart'); await drag(rows[0]!, 'dragover', 10); await drag(rows[0]!, 'drop');
  expect(api.save).toHaveBeenCalledWith({ orderedIds: ['c', 'a', 'b'], disabledIds: [] });
});
it('cancels without saving and ignores external drags', async () => {
  const rows = host.querySelectorAll('li');
  await drag(rows[0]!, 'dragstart'); await drag(rows[2]!, 'dragover', 280); await drag(rows[0]!, 'dragend');
  expect(host.querySelector('.drop-after')).toBeNull();
  await drag(rows[2]!, 'dragover', 280); await drag(rows[2]!, 'drop');
  expect(api.save).not.toHaveBeenCalled();
});
it('does not save or show insertion markers for an unchanged position', async () => {
  const rows = host.querySelectorAll('li');
  await drag(rows[0]!, 'dragstart'); await drag(rows[1]!, 'dragover', 110); await drag(rows[1]!, 'drop');
  expect(api.save).not.toHaveBeenCalled();
});
