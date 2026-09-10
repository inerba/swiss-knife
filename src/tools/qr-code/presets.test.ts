import { describe, expect, it } from 'vitest';
import { defaultQrStyle } from './style';
import { deleteQrStylePreset, normalizeQrStylePresets, upsertQrStylePreset } from './presets';

describe('QR style presets', () => {
  it('treats missing or corrupted storage as an empty list', () => {
    expect(normalizeQrStylePresets(undefined)).toEqual([]);
    expect(normalizeQrStylePresets({ name: 'x' })).toEqual([]);
    expect(normalizeQrStylePresets([{ name: '', style: defaultQrStyle }])).toEqual([]);
  });

  it('keeps named presets and strips any logo or image payload', () => {
    const presets = normalizeQrStylePresets([
      { id: 'u1', name: 'Brand', style: { ...defaultQrStyle, margin: 16 }, logo: 'data:image/png;base64,xx', image: 'http://evil' },
    ]);
    expect(presets).toHaveLength(1);
    expect(presets[0]).toEqual({ id: 'u1', name: 'Brand', style: { ...defaultQrStyle, margin: 16 } });
    expect(presets[0]?.style).not.toHaveProperty('logo');
    expect(presets[0]?.style).not.toHaveProperty('image');
  });

  it('saves a new preset and overwrites when the name already exists', () => {
    const first = upsertQrStylePreset([], 'Brand', { ...defaultQrStyle, margin: 8 });
    expect(first.overwritten).toBe(false);
    expect(first.presets).toHaveLength(1);
    expect(first.presets[0]?.name).toBe('Brand');
    expect(first.presets[0]?.style.margin).toBe(8);

    const second = upsertQrStylePreset(first.presets, 'Brand', { ...defaultQrStyle, margin: 24 });
    expect(second.overwritten).toBe(true);
    expect(second.presets).toHaveLength(1);
    expect(second.presets[0]?.id).toBe(first.presets[0]?.id);
    expect(second.presets[0]?.style.margin).toBe(24);
  });

  it('deletes a user preset by id', () => {
    const saved = upsertQrStylePreset([], 'Brand', defaultQrStyle);
    expect(deleteQrStylePreset(saved.presets, saved.presets[0]!.id)).toEqual([]);
  });
});
