import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GlobalSiteAccessNotice } from './GlobalSiteAccessNotice';

const access = vi.hoisted(() => ({ request: vi.fn(), remove: vi.fn(), enabled: false as boolean | null }));
vi.mock('../lib/global-site-access', () => ({ useGlobalSiteAccess: () => access }));

let root: Root;
let host: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  access.enabled = false;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<GlobalSiteAccessNotice />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('does not render when the global access is already present', async () => {
  access.enabled = true;
  await act(async () => root.render(<GlobalSiteAccessNotice />));
  expect(host.textContent).toBe('');
});

it('requests access from its explicit button and explains a denial', async () => {
  access.request.mockResolvedValue(false);
  const button = host.querySelector<HTMLButtonElement>('button')!;
  await act(async () => button.click());
  expect(access.request).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('icona nella scheda attiva');
});
