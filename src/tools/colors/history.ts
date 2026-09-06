import { browser } from 'wxt/browser';
import { canonical, colorCss, historyInsert, historyRemove, type StoredColor } from './color';
export const COLOR_HISTORY_KEY = 'colorHistory.v1';
export async function loadColorHistory(): Promise<StoredColor[]> {
  const stored = await browser.storage.local.get(COLOR_HISTORY_KEY);
  const value = stored[COLOR_HISTORY_KEY];
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap(item => {
    try {
      if (typeof item?.value !== 'string' || !Number.isFinite(item.updatedAt)) return [];
      const normalized = colorCss(item.value); const id = canonical(normalized);
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ id, value: normalized, updatedAt: item.updatedAt }];
    } catch { return []; }
  }).slice(0, 50);
}
export async function saveColorHistory(history: StoredColor[]) { await browser.storage.local.set({ [COLOR_HISTORY_KEY]: history.slice(0, 50) }); }
async function locked<T>(action: () => Promise<T>) {
  return navigator.locks ? navigator.locks.request(COLOR_HISTORY_KEY, action) : action();
}
export async function addColorHistory(values: string[]) {
  return locked(async () => {
    const next = historyInsert(await loadColorHistory(), values.map(colorCss));
    await saveColorHistory(next);
    return next;
  });
}
export async function clearColorHistory() {
  await locked(async () => { await browser.storage.local.remove(COLOR_HISTORY_KEY); });
}
export async function removeColorHistory(ids: Iterable<string>) {
  return locked(async () => {
    const next = historyRemove(await loadColorHistory(), ids);
    if (next.length) await saveColorHistory(next);
    else await browser.storage.local.remove(COLOR_HISTORY_KEY);
    return next;
  });
}
