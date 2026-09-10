import { describe, expect, it } from 'vitest';
import {
  builtinPresets,
  defaultQrStyle,
  matchingPresetId,
  normalizeQrStyle,
  toLibraryOptions,
} from './style';

describe('QR style', () => {
  it('maps the classic default to square black-on-white library options', () => {
    const options = toLibraryOptions('https://example.it', defaultQrStyle);
    expect(options).toMatchObject({
      width: 300,
      height: 300,
      margin: 10,
      data: 'https://example.it',
      qrOptions: { errorCorrectionLevel: 'M' },
      dotsOptions: { type: 'square', color: '#000000' },
      backgroundOptions: { color: '#ffffff' },
    });
    expect(options.cornersSquareOptions).toEqual({});
    expect(options.cornersDotOptions).toEqual({});
    expect(options.image).toBeUndefined();
  });

  it('drops the opaque background fill when transparency is requested', () => {
    const options = toLibraryOptions('https://example.it', { ...defaultQrStyle, backgroundTransparent: true });
    expect(options.backgroundOptions).toEqual({ color: 'transparent' });
  });

  it('converts a linear gradient rotation from degrees to radians', () => {
    const style = normalizeQrStyle({
      ...defaultQrStyle,
      dots: { mode: 'gradient', color: '#000000', gradient: { type: 'linear', rotation: 180, start: '#111111', end: '#4f46e5' } },
    });
    const options = toLibraryOptions('ok', style);
    expect(options.dotsOptions?.gradient).toEqual({
      type: 'linear',
      rotation: Math.PI,
      colorStops: [{ offset: 0, color: '#111111' }, { offset: 1, color: '#4f46e5' }],
    });
    expect(options.dotsOptions?.color).toBeUndefined();
  });

  it('omits corner type and color when they stay on default / cleared', () => {
    const options = toLibraryOptions('ok', defaultQrStyle);
    expect(options.cornersSquareOptions).toEqual({});
    expect(options.cornersDotOptions).toEqual({});
  });

  it('forces high error correction when a logo is present', () => {
    const options = toLibraryOptions('ok', defaultQrStyle, 'data:image/png;base64,aa');
    expect(options.qrOptions?.errorCorrectionLevel).toBe('H');
    expect(options.image).toBe('data:image/png;base64,aa');
    expect(options.imageOptions).toMatchObject({ hideBackgroundDots: true, saveAsBlob: true });
  });

  it('exports builtin presets without a logo image', () => {
    expect(builtinPresets.map(item => item.id)).toEqual(['classico', 'arrotondato', 'extra-arrotondato', 'classy', 'punti']);
    for (const preset of builtinPresets) {
      expect(preset.style).not.toHaveProperty('logo');
      expect(preset.style).not.toHaveProperty('image');
      expect(toLibraryOptions('ok', preset.style).image).toBeUndefined();
    }
    expect(builtinPresets[0]?.style).toEqual(defaultQrStyle);
    expect(builtinPresets.find(item => item.id === 'arrotondato')?.style.dotsType).toBe('rounded');
    expect(builtinPresets.find(item => item.id === 'punti')?.style.dotsType).toBe('dots');
  });

  it('matches a builtin preset id from the current style', () => {
    expect(matchingPresetId(defaultQrStyle, [])).toBe('classico');
    expect(matchingPresetId(builtinPresets.find(item => item.id === 'classy')!.style, [])).toBe('classy');
    expect(matchingPresetId({ ...defaultQrStyle, margin: 40 }, [])).toBe('');
  });

  it('clamps invalid stored values back to a usable style', () => {
    const style = normalizeQrStyle({ size: 40, margin: -3, dotsType: 'hexagon', errorCorrection: 'Z', imageSize: 2 });
    expect(style.size).toBe(200);
    expect(style.margin).toBe(0);
    expect(style.dotsType).toBe('square');
    expect(style.errorCorrection).toBe('M');
    expect(style.imageSize).toBeLessThanOrEqual(0.5);
  });
});
