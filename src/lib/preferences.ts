import { browser } from 'wxt/browser';

export type CatalogOrder = 'custom' | 'alphabetical';
export interface ToolPreferences { orderedIds: string[]; disabledIds: string[]; }
export const TOOL_PREFERENCES_KEY = 'toolPreferences';
export const CATALOG_ORDER_KEY = 'catalogOrder';

export function normalizeToolPreferences(value: unknown, toolIds: readonly string[]): ToolPreferences {
  const source = value && typeof value === 'object' ? value as Partial<ToolPreferences> : {};
  const valid = new Set(toolIds);
  const seen = new Set<string>();
  const orderedIds = Array.isArray(source.orderedIds) ? source.orderedIds.filter((id): id is string => typeof id === 'string' && valid.has(id) && !seen.has(id) && !!seen.add(id)) : [];
  for (const id of toolIds) if (!seen.has(id)) orderedIds.push(id);
  const disabledIds = Array.isArray(source.disabledIds) ? [...new Set(source.disabledIds.filter((id): id is string => typeof id === 'string' && valid.has(id)))] : [];
  return { orderedIds, disabledIds };
}

export function isCatalogOrder(value: unknown): value is CatalogOrder { return value === 'custom' || value === 'alphabetical'; }

export async function loadToolPreferences(toolIds: readonly string[]) {
  const stored = await browser.storage.local.get([TOOL_PREFERENCES_KEY, CATALOG_ORDER_KEY]);
  return { preferences: normalizeToolPreferences(stored[TOOL_PREFERENCES_KEY], toolIds), catalogOrder: isCatalogOrder(stored[CATALOG_ORDER_KEY]) ? stored[CATALOG_ORDER_KEY] : 'custom' as CatalogOrder };
}

export async function saveToolPreferences(preferences: ToolPreferences) { await browser.storage.local.set({ [TOOL_PREFERENCES_KEY]: preferences }); }
export async function saveCatalogOrder(catalogOrder: CatalogOrder) { await browser.storage.local.set({ [CATALOG_ORDER_KEY]: catalogOrder }); }
