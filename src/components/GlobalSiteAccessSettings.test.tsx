import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GlobalSiteAccessSettings } from './GlobalSiteAccessSettings';

const access = vi.hoisted(() => ({ request: vi.fn(), remove: vi.fn(), enabled: true as boolean | null }));
vi.mock('../lib/global-site-access', () => ({ useGlobalSiteAccess: () => access }));

let root: Root;
let host: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  access.enabled = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<GlobalSiteAccessSettings />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('removes the global permission without claiming to remove individual grants', async () => {
  access.remove.mockResolvedValue(true);
  const button = host.querySelector<HTMLButtonElement>('button')!;
  await act(async () => button.click());
  expect(access.remove).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('I consensi per singolo sito restano invariati.');
});
