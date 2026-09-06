import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

export const GLOBAL_SITE_ACCESS_ORIGIN = '<all_urls>';

export async function hasGlobalSiteAccess() {
  return browser.permissions.contains({ origins: [GLOBAL_SITE_ACCESS_ORIGIN] });
}

export async function requestGlobalSiteAccess() {
  return browser.permissions.request({ origins: [GLOBAL_SITE_ACCESS_ORIGIN] });
}

export async function removeGlobalSiteAccess() {
  return browser.permissions.remove({ origins: [GLOBAL_SITE_ACCESS_ORIGIN] });
}

export function useGlobalSiteAccess() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const granted = await hasGlobalSiteAccess();
    setEnabled(granted);
    return granted;
  }, []);

  useEffect(() => {
    void refresh();
    const update = () => { void refresh(); };
    browser.permissions.onAdded.addListener(update);
    browser.permissions.onRemoved.addListener(update);
    return () => {
      browser.permissions.onAdded.removeListener(update);
      browser.permissions.onRemoved.removeListener(update);
    };
  }, [refresh]);

  const request = useCallback(async () => {
    // `permissions.request` must be the first browser call in a click handler.
    const granted = await requestGlobalSiteAccess();
    setEnabled(granted);
    return granted;
  }, []);

  const remove = useCallback(async () => {
    const removed = await removeGlobalSiteAccess();
    if (removed) setEnabled(false);
    return removed;
  }, []);

  return { enabled, request, remove, refresh };
}
