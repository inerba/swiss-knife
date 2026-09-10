import { describe, expect, it } from 'vitest';
import { defaultPasswordGeneratorPreferences, normalizePasswordGeneratorPreferences } from './preferences';

describe('password generator preferences', () => {
  it('uses safe defaults for absent or invalid stored values', () => {
    expect(normalizePasswordGeneratorPreferences(undefined)).toEqual(defaultPasswordGeneratorPreferences);
    expect(normalizePasswordGeneratorPreferences({ length: 99, numbers: 'yes', password: 'secret' })).toEqual(defaultPasswordGeneratorPreferences);
  });
  it('keeps a valid option set and ignores a stored password field', () => {
    const value = { ...defaultPasswordGeneratorPreferences, length: 24, excludeRepeats: true, password: 'N0tSaved!' };
    expect(normalizePasswordGeneratorPreferences(value)).toEqual({ ...defaultPasswordGeneratorPreferences, length: 24, excludeRepeats: true });
  });
  it('keeps an explicit empty symbol set and ignores a stored password', () => {
    const value = { ...defaultPasswordGeneratorPreferences, symbolSet: '', password: 'N0tSaved!' };
    expect(normalizePasswordGeneratorPreferences(value)).toEqual({ ...defaultPasswordGeneratorPreferences, symbolSet: '' });
  });
  it('fills a missing symbol set with the factory alphabet', () => {
    const { symbolSet: _, ...rest } = defaultPasswordGeneratorPreferences;
    expect(normalizePasswordGeneratorPreferences(rest).symbolSet).toBe(defaultPasswordGeneratorPreferences.symbolSet);
  });
});
