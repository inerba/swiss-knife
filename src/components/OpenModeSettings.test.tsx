import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OpenModeSettings } from './OpenModeSettings';

const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock('../lib/floating-window', () => ({ loadOpenMode: api.load, saveOpenMode: api.save }));
let root: Root, host: HTMLDivElement;
const radio = (value: string) => host.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
beforeEach(async () => {
  vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  api.load.mockResolvedValue('sidepanel');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<OpenModeSettings />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('shows the saved mode and saves a new choice', async () => {
  expect(radio('sidepanel').checked).toBe(true);
  api.save.mockResolvedValue(undefined);
  await act(async () => radio('floating').click());
  expect(api.save).toHaveBeenCalledWith('floating');
  expect(radio('floating').checked).toBe(true);
  expect(host.textContent).toContain('Vale dal prossimo clic');
});
it('restores the previous choice when saving fails', async () => {
  api.save.mockRejectedValue(new Error('quota'));
  await act(async () => radio('floating').click());
  expect(radio('sidepanel').checked).toBe(true);
  expect(host.textContent).toContain('Impossibile salvare');
});
