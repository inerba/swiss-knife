import { beforeEach, expect, it, vi } from 'vitest';
import { GLOBAL_SITE_ACCESS_ORIGIN, hasGlobalSiteAccess, removeGlobalSiteAccess, requestGlobalSiteAccess } from './global-site-access';

const permissions = vi.hoisted(() => ({ contains: vi.fn(), request: vi.fn(), remove: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { permissions } }));

beforeEach(() => vi.clearAllMocks());

it('checks the optional global host permission', async () => {
  permissions.contains.mockResolvedValue(true);
  await expect(hasGlobalSiteAccess()).resolves.toBe(true);
  expect(permissions.contains).toHaveBeenCalledWith({ origins: [GLOBAL_SITE_ACCESS_ORIGIN] });
});

it('requests and removes only the global host permission', async () => {
  permissions.request.mockResolvedValue(false);
  permissions.remove.mockResolvedValue(true);
  await expect(requestGlobalSiteAccess()).resolves.toBe(false);
  await expect(removeGlobalSiteAccess()).resolves.toBe(true);
  expect(permissions.request).toHaveBeenCalledWith({ origins: ['<all_urls>'] });
  expect(permissions.remove).toHaveBeenCalledWith({ origins: ['<all_urls>'] });
});
