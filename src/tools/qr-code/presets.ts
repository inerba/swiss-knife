import { browser } from 'wxt/browser';
import { normalizeQrStyle, type QrStyle } from './style';

export interface QrUserPreset {
  id: string;
  name: string;
  style: QrStyle;
}

export const QR_STYLE_PRESETS_KEY = 'qrStylePresets';

function presetId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `preset-${Date.now()}`;
}

export function normalizeQrStylePresets(value: unknown): QrUserPreset[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const presets: QrUserPreset[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as { id?: unknown; name?: unknown; style?: unknown };
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) continue;
    const id = typeof raw.id === 'string' && raw.id.trim() && !seen.has(raw.id) ? raw.id : presetId();
    if (seen.has(id)) continue;
    seen.add(id);
    presets.push({ id, name, style: normalizeQrStyle(raw.style) });
  }
  return presets;
}

export function upsertQrStylePreset(presets: QrUserPreset[], name: string, style: QrStyle) {
  const label = name.trim();
  if (!label) throw new Error('Inserisci un nome per il preset.');
  const nextStyle = normalizeQrStyle(style);
  const existing = presets.find(item => item.name.toLocaleLowerCase('it') === label.toLocaleLowerCase('it'));
  if (existing) {
    return {
      overwritten: true,
      presets: presets.map(item => item.id === existing.id ? { ...item, name: label, style: nextStyle } : item),
    };
  }
  return { overwritten: false, presets: [...presets, { id: presetId(), name: label, style: nextStyle }] };
}

export function deleteQrStylePreset(presets: QrUserPreset[], id: string) {
  return presets.filter(item => item.id !== id);
}

export async function loadQrStylePresets() {
  const stored = await browser.storage.local.get(QR_STYLE_PRESETS_KEY);
  return normalizeQrStylePresets(stored[QR_STYLE_PRESETS_KEY]);
}

export async function saveQrStylePresets(presets: QrUserPreset[]) {
  await browser.storage.local.set({ [QR_STYLE_PRESETS_KEY]: presets });
}
