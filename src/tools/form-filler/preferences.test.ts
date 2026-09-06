import { describe, expect, it } from 'vitest';
import { defaultFormFillerPreferences, normalizeFormFillerPreferences } from './preferences';

describe('form filler preferences', () => {
  it('uses safe defaults for absent or invalid stored values', () => {
    expect(normalizeFormFillerPreferences(undefined)).toEqual(defaultFormFillerPreferences);
    expect(normalizeFormFillerPreferences({ locale: 'fr', preserveExisting: false, password: 8 })).toEqual({ ...defaultFormFillerPreferences, preserveExisting: false });
  });
  it('preserves the supported locale and local settings', () => {
    expect(normalizeFormFillerPreferences({ locale: 'it', password: 'Segreta', ignored: 'captcha', preserveExisting: false })).toEqual({ locale: 'it', password: 'Segreta', ignored: 'captcha', preserveExisting: false });
  });
});
